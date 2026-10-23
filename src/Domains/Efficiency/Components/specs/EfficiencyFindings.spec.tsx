import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFinding, TRuleId } from '../../Efficiency.entity';
import { EfficiencyFindings } from '../EfficiencyFindings';

const makeFinding = (
  ruleId: TRuleId,
  overrides: Partial<TFinding> = {},
): TFinding => ({
  ruleId,
  severity: 'media',
  dimension: 'ejecucion',
  penalizes: true,
  evidence: {
    sessionId: 'root',
    messageId: `msg_${ruleId}`,
    turnIndex: 1,
  },
  quote: `[turno 1 · msg_${ruleId}] "evidencia de ${ruleId}"`,
  condition: `Condición medida de ${ruleId}`,
  recommendation: `Recomendación de ${ruleId}`,
  ...overrides,
});

const SEVEN_FINDINGS: TRuleId[] = [
  'INP-1',
  'INP-2',
  'INP-3',
  'INP-4',
  'RES-1',
  'RES-2',
  'RES-3',
];

/**
 * Sección de hallazgos (FR-019/FR-025/FR-026; contrato overlay §5.3): pinta los
 * penalizantes en el orden del motor, deja los cinco primeros visibles y el
 * resto bajo “Ver N hallazgos más”, y mantiene las señales débiles en su propia
 * sección “Señales (no restan)” sin tocar la nota.
 */
describe('EfficiencyFindings', () => {
  it('pinta los hallazgos en el orden recibido del motor', () => {
    render(
      <EfficiencyFindings
        findings={[
          makeFinding('INP-1'),
          makeFinding('RES-1'),
          makeFinding('INP-4'),
        ]}
        weakSignals={[]}
      />,
    );

    const cards = screen.getAllByRole('article');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Hallazgo INP-1',
      'Hallazgo RES-1',
      'Hallazgo INP-4',
    ]);
  });

  it('muestra condición, cita, severidad y recomendación de cada hallazgo', () => {
    render(
      <EfficiencyFindings findings={[makeFinding('INP-1')]} weakSignals={[]} />,
    );

    const card = screen.getByRole('article', { name: 'Hallazgo INP-1' });
    expect(
      within(card).getByText('Condición medida de INP-1'),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('[turno 1 · msg_INP-1] "evidencia de INP-1"'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Severidad media')).toBeInTheDocument();
    expect(
      within(card).getByText('Recomendación de INP-1'),
    ).toBeInTheDocument();
  });

  it('separa las señales débiles en "Señales (no restan)"', () => {
    render(
      <EfficiencyFindings
        findings={[makeFinding('INP-1')]}
        weakSignals={[
          makeFinding('RES-4', { penalizes: false, dimension: 'contexto' }),
          makeFinding('RES-5', { penalizes: false, dimension: 'resultado' }),
        ]}
      />,
    );

    const findingsSection = screen.getByText('Hallazgos').parentElement;
    const weakSection = screen.getByText('Señales (no restan)').parentElement;

    expect(findingsSection).not.toBeNull();
    expect(weakSection).not.toBeNull();
    expect(
      within(findingsSection as HTMLElement).getByRole('article', {
        name: 'Hallazgo INP-1',
      }),
    ).toBeInTheDocument();
    expect(
      within(findingsSection as HTMLElement).queryByLabelText('Hallazgo RES-4'),
    ).not.toBeInTheDocument();
    expect(
      within(weakSection as HTMLElement).getByRole('article', {
        name: 'Hallazgo RES-4',
      }),
    ).toBeInTheDocument();
    expect(
      within(weakSection as HTMLElement).getByRole('article', {
        name: 'Hallazgo RES-5',
      }),
    ).toBeInTheDocument();
  });

  it('no pinta nota ni comparaciones que las señales pudieran alterar', () => {
    const { container } = render(
      <EfficiencyFindings
        findings={[makeFinding('INP-1')]}
        weakSignals={[makeFinding('RES-4', { penalizes: false })]}
      />,
    );

    expect(container.textContent).not.toMatch(/\bde 100\b/);
    expect(container.textContent).not.toMatch(/puntuaci[oó]n|nota/i);
  });

  it('muestra solo cinco hallazgos y el resto bajo "Ver 2 hallazgos más"', async () => {
    const user = userEvent.setup();
    render(
      <EfficiencyFindings
        findings={SEVEN_FINDINGS.map((ruleId) => makeFinding(ruleId))}
        weakSignals={[]}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryByLabelText('Hallazgo RES-2')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hallazgo RES-3')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', {
      name: 'Ver 2 hallazgos más',
    });
    expect(expand).toHaveAttribute('aria-expanded', 'false');

    await user.click(expand);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(7);
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
      SEVEN_FINDINGS.map((ruleId) => `Hallazgo ${ruleId}`),
    );
    expect(
      screen.getByRole('button', { name: 'Ver menos' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));

    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryByLabelText('Hallazgo RES-2')).not.toBeInTheDocument();
  });

  it('no ofrece "Ver N más" cuando hay cinco hallazgos o menos', () => {
    render(
      <EfficiencyFindings
        findings={SEVEN_FINDINGS.slice(0, 5).map((ruleId) =>
          makeFinding(ruleId),
        )}
        weakSignals={[]}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('declara "Sin hallazgos" cuando solo hay señales débiles', () => {
    render(
      <EfficiencyFindings
        findings={[]}
        weakSignals={[makeFinding('RES-4', { penalizes: false })]}
      />,
    );

    expect(screen.getByText('Sin hallazgos')).toBeInTheDocument();
    expect(
      screen.queryByText('Sin señales débiles'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(
      screen.getByRole('article', { name: 'Hallazgo RES-4' }),
    ).toBeInTheDocument();
  });

  it('declara ambos vacíos sin tarjetas ni controles', () => {
    render(<EfficiencyFindings findings={[]} weakSignals={[]} />);

    expect(screen.getByText('Sin hallazgos')).toBeInTheDocument();
    expect(screen.getByText('Sin señales débiles')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
