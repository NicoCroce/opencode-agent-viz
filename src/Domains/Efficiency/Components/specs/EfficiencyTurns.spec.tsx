import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TTurnAnalysis } from '../../Efficiency.entity';
import { EfficiencyTurns } from '../EfficiencyTurns';

const LONG_PROMPT = `${'a'.repeat(125)}COLA-OCULTA`;

const makeTurn = (overrides: Partial<TTurnAnalysis> = {}): TTurnAnalysis => ({
  index: 1,
  userMessageId: 'msg_user_1',
  at: Date.UTC(2026, 0, 15, 10, 30),
  prompt: 'Pedido corto',
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
 * Selector de presentación de turnos (FR-034, contrato §5.4): tarjetas en móvil
 * y tabla en escritorio, ambas alimentadas por la misma lista y sin `md:hidden`.
 */
describe('EfficiencyTurns', () => {
  it('en móvil pinta tarjetas y ninguna tabla', () => {
    render(<EfficiencyTurns turns={[makeTurn()]} isMobile />);

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('en escritorio pinta la tabla y ninguna tarjeta', () => {
    render(<EfficiencyTurns turns={[makeTurn()]} isMobile={false} />);

    expect(
      screen.getByRole('table', { name: 'Turnos de la sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('ambas presentaciones muestran la misma información', () => {
    const turns = [
      makeTurn({
        clarifications: 3,
        outcome: 'failed',
        cost: 0.0123,
        durationMs: 65_000,
        signals: ['RES-1'],
      }),
      makeTurn({ index: 2, userMessageId: 'msg_b', prompt: LONG_PROMPT }),
    ];
    const essential = ['Pedido corto', '3', 'Fallo', '$0.0123', '1m 5s', 'RES-1'];

    const mobile = render(<EfficiencyTurns turns={turns} isMobile />);
    for (const value of essential) {
      expect(mobile.container.textContent).toContain(value);
    }
    expect(mobile.container.textContent).not.toContain(LONG_PROMPT);
    mobile.unmount();

    const desktop = render(<EfficiencyTurns turns={turns} isMobile={false} />);
    for (const value of essential) {
      expect(desktop.container.textContent).toContain(value);
    }
    expect(desktop.container.textContent).not.toContain(LONG_PROMPT);
  });

  it('en móvil un prompt largo sigue siendo expandible y conserva el detalle', () => {
    render(<EfficiencyTurns turns={[makeTurn({ prompt: LONG_PROMPT })]} isMobile />);

    const card = screen.getByRole('article');
    expect(within(card).getByText('a'.repeat(120))).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Ver detalle' }),
    ).toBeInTheDocument();
    expect(card.textContent).not.toContain('COLA-OCULTA');
  });
});
