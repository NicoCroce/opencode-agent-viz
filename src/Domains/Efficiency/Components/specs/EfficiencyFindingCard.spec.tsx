import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFinding, TSeverity } from '../../Efficiency.entity';
import { SEVERITY_LABEL } from '../../lib/labels';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../../lib/thresholds';
import { EfficiencyFindingCard } from '../EfficiencyFindingCard';

const SHORT_QUOTE =
  '[turno 2 · msg_user_2 · tool bash · 10:31] "instala las dependencias"';
const LONG_QUOTE = `${'a'.repeat(
  PROMPT_TRUNCATE_CODE_POINTS + 10,
)}COLA-OCULTA`;

const makeFinding = (overrides: Partial<TFinding> = {}): TFinding => ({
  ruleId: 'RES-1',
  severity: 'media',
  dimension: 'ejecucion',
  penalizes: true,
  evidence: {
    sessionId: 'root',
    messageId: 'msg_user_2',
    toolId: 'tool_1',
    turnIndex: 2,
    at: Date.UTC(2026, 0, 15, 10, 31),
  },
  quote: SHORT_QUOTE,
  condition: '12 % de las llamadas falló (6 de 50)',
  recommendation: 'Revisa la ruta antes de reintentar la herramienta.',
  ...overrides,
});

/**
 * Tarjeta de un hallazgo (FR-023/FR-028/FR-030; contrato overlay §5.3):
 * `ruleId`, severidad con texto + icono decorativo, condición medida, cita con
 * ancla recortada a 120 code points y recomendación. El texto completo de la
 * cita se monta **solo** al expandir y se desmonta al colapsar.
 */
describe('EfficiencyFindingCard', () => {
  it('pinta ruleId, severidad, condición, cita y recomendación', () => {
    const finding = makeFinding();
    render(<EfficiencyFindingCard finding={finding} />);

    const card = screen.getByRole('article', { name: 'Hallazgo RES-1' });
    expect(within(card).getByText('RES-1')).toBeInTheDocument();
    expect(
      within(card).getByText(`Severidad ${SEVERITY_LABEL.media}`),
    ).toBeInTheDocument();
    expect(within(card).getByText('Condición')).toBeInTheDocument();
    expect(within(card).getByText(finding.condition)).toBeInTheDocument();
    expect(within(card).getByText('Cita')).toBeInTheDocument();
    expect(within(card).getByText(SHORT_QUOTE)).toBeInTheDocument();
    expect(within(card).getByText('Recomendación')).toBeInTheDocument();
    expect(
      within(card).getByText(finding.recommendation),
    ).toBeInTheDocument();
  });

  it.each([
    ['alta', 'circle-alert'],
    ['media', 'triangle-alert'],
    ['baja', 'info'],
  ] as const)(
    'comunica la severidad %s con texto e icono decorativo',
    (severity: TSeverity, iconName: string) => {
      render(<EfficiencyFindingCard finding={makeFinding({ severity })} />);

      const label = screen.getByText(`Severidad ${SEVERITY_LABEL[severity]}`);
      const icon = label.querySelector('svg');

      expect(icon).toHaveClass(`lucide-${iconName}`);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('conserva el ancla de turno y mensaje en la cita', () => {
    render(<EfficiencyFindingCard finding={makeFinding()} />);

    expect(
      screen.getByText(/\[turno 2 · msg_user_2 · tool bash · 10:31\]/),
    ).toBeInTheDocument();
  });

  it('recorta la cita a 120 code points y no monta el texto completo', () => {
    const { container } = render(
      <EfficiencyFindingCard finding={makeFinding({ quote: LONG_QUOTE })} />,
    );

    expect(
      screen.getByText('a'.repeat(PROMPT_TRUNCATE_CODE_POINTS)),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('COLA-OCULTA');
    expect(
      screen.queryByRole('region', { name: 'Ver cita completa' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver cita completa' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('monta la cita completa solo al expandir y la desmonta al colapsar', async () => {
    const user = userEvent.setup();
    render(<EfficiencyFindingCard finding={makeFinding({ quote: LONG_QUOTE })} />);

    await user.click(screen.getByRole('button', { name: 'Ver cita completa' }));

    const collapse = screen.getByRole('button', {
      name: 'Ocultar cita completa',
    });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', { name: 'Ver cita completa' });
    expect(collapse).toHaveAttribute('aria-controls', region.id);
    expect(within(region).getByText(LONG_QUOTE)).toBeInTheDocument();

    await user.click(collapse);

    expect(screen.queryByText(LONG_QUOTE)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver cita completa' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('no ofrece expansión cuando la cita cabe entera', () => {
    render(
      <EfficiencyFindingCard
        finding={makeFinding({
          quote: 'a'.repeat(PROMPT_TRUNCATE_CODE_POINTS),
        })}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ofrece expansión en cuanto la cita supera los 120 code points', () => {
    render(
      <EfficiencyFindingCard
        finding={makeFinding({
          quote: 'a'.repeat(PROMPT_TRUNCATE_CODE_POINTS + 1),
        })}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Ver cita completa' }),
    ).toBeInTheDocument();
  });
});
