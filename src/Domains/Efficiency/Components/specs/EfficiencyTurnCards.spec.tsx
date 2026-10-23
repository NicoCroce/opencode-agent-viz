import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TTurnAnalysis } from '../../Efficiency.entity';
import { NEUTRAL_COPY, OUTCOME_LABEL, TURN_LABEL } from '../../lib/labels';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../../lib/thresholds';
import { EfficiencyTurnCards } from '../EfficiencyTurnCards';

const LONG_PROMPT = `${'a'.repeat(
  PROMPT_TRUNCATE_CODE_POINTS + 5,
)}COLA-OCULTA`;
const TRUNCATED_PROMPT = 'a'.repeat(PROMPT_TRUNCATE_CODE_POINTS);
const SHORT_PROMPT = 'Pedido corto';

const turnHeading = (index: number): string => `${TURN_LABEL.turn} ${index}`;
const detailRegionName = (index: number): string =>
  `Detalle del turno ${index}`;

const makeTurn = (overrides: Partial<TTurnAnalysis> = {}): TTurnAnalysis => ({
  index: 1,
  userMessageId: 'msg_user_1',
  at: Date.UTC(2026, 0, 15, 10, 30),
  prompt: SHORT_PROMPT,
  promptTokens: 2,
  closed: true,
  outcome: 'succeeded',
  clarifications: 0,
  steps: 2,
  toolCalls: 1,
  toolErrors: 0,
  retries: 0,
  cost: 0.01,
  durationMs: 1_500,
  signals: [],
  ...overrides,
});

/**
 * Tarjetas de turnos en móvil (FR-030…FR-035, contrato §5.4): un `<article>` por
 * turno con los mismos campos esenciales que la tabla, prompt recortado y
 * detalle montado solo al expandir, sin tabla ancha.
 */
describe('EfficiencyTurnCards', () => {
  it('pinta un article por turno en orden de index', () => {
    render(
      <EfficiencyTurnCards
        turns={[
          makeTurn({ index: 2, userMessageId: 'msg_b', prompt: 'Segundo' }),
          makeTurn({ index: 1, userMessageId: 'msg_a', prompt: 'Primero' }),
        ]}
      />,
    );

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(
      articles.map((article) =>
        within(article).getByRole('heading').textContent,
      ),
    ).toEqual([turnHeading(1), turnHeading(2)]);
  });

  it('muestra los campos esenciales de cada turno', () => {
    render(
      <EfficiencyTurnCards
        turns={[
          makeTurn({
            clarifications: 3,
            outcome: 'failed',
            cost: 0.0123,
            durationMs: 65_000,
            signals: ['RES-1'],
          }),
        ]}
      />,
    );

    const card = screen.getByRole('article');
    expect(within(card).getByText(SHORT_PROMPT)).toBeInTheDocument();
    expect(
      within(card).getByText(TURN_LABEL.clarifications),
    ).toBeInTheDocument();
    expect(within(card).getByText('3')).toBeInTheDocument();
    expect(within(card).getByText(OUTCOME_LABEL.failed)).toBeInTheDocument();
    expect(within(card).getByText('$0.0123')).toBeInTheDocument();
    expect(within(card).getByText('1m 5s')).toBeInTheDocument();
    expect(within(card).getByText('RES-1')).toBeInTheDocument();
  });

  it('no renderiza tabla ancha y contiene el texto con min-w-0/break-words', () => {
    render(
      <EfficiencyTurnCards
        turns={[makeTurn({ prompt: 'x'.repeat(300) })]}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const card = screen.getByRole('article');
    expect(card).toHaveClass('min-w-0');
    expect(card).toHaveClass('break-words');
    expect(within(card).getByText('x'.repeat(PROMPT_TRUNCATE_CODE_POINTS))).toHaveClass('break-words');
  });

  it('recorta el prompt al umbral y no monta el detalle colapsado', () => {
    const { container } = render(
      <EfficiencyTurnCards turns={[makeTurn({ prompt: LONG_PROMPT })]} />,
    );

    expect(screen.getByText(TRUNCATED_PROMPT)).toBeInTheDocument();
    expect(container.textContent).not.toContain('COLA-OCULTA');
    expect(
      screen.queryByRole('region', { name: detailRegionName(1) }),
    ).not.toBeInTheDocument();
  });

  it('expande y colapsa el detalle con aria-expanded y aria-controls', async () => {
    const user = userEvent.setup();
    render(<EfficiencyTurnCards turns={[makeTurn({ prompt: LONG_PROMPT })]} />);

    const expand = screen.getByRole('button', { name: TURN_LABEL.expand });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).not.toHaveAttribute('aria-controls');

    await user.click(expand);

    const collapse = screen.getByRole('button', { name: TURN_LABEL.collapse });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const detail = screen.getByRole('region', {
      name: detailRegionName(1),
    });
    expect(collapse).toHaveAttribute('aria-controls', detail.id);
    expect(within(detail).getByText(LONG_PROMPT)).toBeInTheDocument();

    await user.click(collapse);

    expect(
      screen.queryByRole('region', { name: detailRegionName(1) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(LONG_PROMPT)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: TURN_LABEL.expand }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('no ofrece expansión cuando el prompt es corto', () => {
    render(
      <EfficiencyTurnCards
        turns={[makeTurn({ prompt: SHORT_PROMPT, signals: ['INP-1'] })]}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(SHORT_PROMPT)).toBeInTheDocument();
    expect(screen.getByText('INP-1')).toBeInTheDocument();
  });

  it('marca el turno abierto y deja el tiempo como "—" sin now', () => {
    render(
      <EfficiencyTurnCards
        turns={[
          makeTurn({ closed: false, outcome: null, durationMs: null }),
        ]}
      />,
    );

    const card = screen.getByRole('article');
    expect(within(card).getByText(TURN_LABEL.open)).toBeInTheDocument();
    expect(
      within(card).getByLabelText(TURN_LABEL.unavailableTime),
    ).toHaveTextContent('—');
    expect(
      within(card).getByLabelText(TURN_LABEL.unavailableOutcome),
    ).toHaveTextContent('—');
  });

  it('muestra "no disponible" en coste y tiempo ausentes', () => {
    render(
      <EfficiencyTurnCards turns={[makeTurn({ cost: null, durationMs: null })]} />,
    );

    const card = screen.getByRole('article');
    expect(
      within(card).getByLabelText(TURN_LABEL.unavailableCost),
    ).toHaveTextContent(NEUTRAL_COPY.unavailable);
    expect(
      within(card).getByLabelText(TURN_LABEL.unavailableTime),
    ).toHaveTextContent(NEUTRAL_COPY.unavailable);
  });

  it('declara el vacío cuando no hay turnos', () => {
    render(<EfficiencyTurnCards turns={[]} />);

    expect(screen.getByText(TURN_LABEL.empty)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
