import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TTurnAnalysis } from '../../Efficiency.entity';
import { NEUTRAL_COPY, OUTCOME_LABEL, TURN_LABEL } from '../../lib/labels';
import { PROMPT_TRUNCATE_CODE_POINTS } from '../../lib/thresholds';
import { EfficiencyTurnTable } from '../EfficiencyTurnTable';

const LONG_PROMPT = `${'a'.repeat(
  PROMPT_TRUNCATE_CODE_POINTS + 5,
)}COLA-OCULTA`;
const TRUNCATED_PROMPT = 'a'.repeat(PROMPT_TRUNCATE_CODE_POINTS);
const SHORT_PROMPT = 'Pedido corto';

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

const COLUMNS = [
  TURN_LABEL.turn,
  TURN_LABEL.prompt,
  TURN_LABEL.clarifications,
  TURN_LABEL.outcome,
  TURN_LABEL.cost,
  TURN_LABEL.time,
  TURN_LABEL.signals,
];

/**
 * Tabla cronológica de turnos (FR-031…FR-035, contrato §5.4): caption, columnas
 * con `scope="col"`, orden por `index`, prompt recortado y expansión bajo
 * demanda que monta `EfficiencyTurnDetail`.
 */
describe('EfficiencyTurnTable', () => {
  it('expone la tabla con caption accesible y columnas con scope="col"', () => {
    render(<EfficiencyTurnTable turns={[makeTurn()]} />);

    expect(
      screen.getByRole('table', { name: 'Turnos de la sesión' }),
    ).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(COLUMNS);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('ordena las filas por index aunque reciba los turnos desordenados', () => {
    render(
      <EfficiencyTurnTable
        turns={[
          makeTurn({ index: 2, userMessageId: 'msg_b', prompt: 'Segundo' }),
          makeTurn({ index: 1, userMessageId: 'msg_a', prompt: 'Primero' }),
        ]}
      />,
    );

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((cell) => cell.textContent)).toEqual(['1', '2']);
  });

  it('muestra los campos esenciales de cada turno', () => {
    render(
      <EfficiencyTurnTable
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

    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Pedido corto')).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText(OUTCOME_LABEL.failed)).toBeInTheDocument();
    expect(within(row).getByText('$0.0123')).toBeInTheDocument();
    expect(within(row).getByText('1m 5s')).toBeInTheDocument();
    expect(within(row).getByText('RES-1')).toBeInTheDocument();
  });

  it('recorta el prompt al umbral y no monta el detalle colapsado', () => {
    const { container } = render(
      <EfficiencyTurnTable turns={[makeTurn({ prompt: LONG_PROMPT })]} />,
    );

    expect(screen.getByText(TRUNCATED_PROMPT)).toBeInTheDocument();
    expect(container.textContent).not.toContain('COLA-OCULTA');
    expect(
      screen.queryByRole('region', { name: detailRegionName(1) }),
    ).not.toBeInTheDocument();
  });

  it('expande y colapsa el detalle con aria-expanded y aria-controls', async () => {
    const user = userEvent.setup();
    render(<EfficiencyTurnTable turns={[makeTurn({ prompt: LONG_PROMPT })]} />);

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
    expect(
      screen.queryByText(LONG_PROMPT),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: TURN_LABEL.expand }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('no ofrece expansión cuando el prompt es corto', () => {
    render(
      <EfficiencyTurnTable
        turns={[
          makeTurn({
            prompt: SHORT_PROMPT,
            signals: ['INP-1'],
          }),
        ]}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(SHORT_PROMPT)).toBeInTheDocument();
    expect(screen.getByText('INP-1')).toBeInTheDocument();
  });

  it('marca el turno abierto y deja el tiempo como "—" sin now', () => {
    render(
      <EfficiencyTurnTable
        turns={[
          makeTurn({
            closed: false,
            outcome: null,
            durationMs: null,
          }),
        ]}
      />,
    );

    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText(TURN_LABEL.open)).toBeInTheDocument();
    expect(
      within(row).getByLabelText(TURN_LABEL.unavailableTime),
    ).toHaveTextContent('—');
  });

  it('muestra "no disponible" en coste y tiempo ausentes', () => {
    render(
      <EfficiencyTurnTable
        turns={[makeTurn({ cost: null, durationMs: null })]}
      />,
    );

    const row = screen.getAllByRole('row')[1];
    expect(
      within(row).getByLabelText(TURN_LABEL.unavailableCost),
    ).toHaveTextContent(NEUTRAL_COPY.unavailable);
    expect(
      within(row).getByLabelText(TURN_LABEL.unavailableTime),
    ).toHaveTextContent(NEUTRAL_COPY.unavailable);
  });

  it('declara el vacío cuando no hay turnos', () => {
    render(<EfficiencyTurnTable turns={[]} />);

    expect(screen.getByText(TURN_LABEL.empty)).toBeInTheDocument();
  });
});
