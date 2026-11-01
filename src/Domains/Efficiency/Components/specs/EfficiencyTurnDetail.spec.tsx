import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatClock } from '@app/Application/Helpers/format/clock';
import type { TTurnAnalysis } from '../../Efficiency.entity';
import { EfficiencyTurnDetail } from '../EfficiencyTurnDetail';

const makeTurn = (overrides: Partial<TTurnAnalysis> = {}): TTurnAnalysis => ({
  index: 1,
  userMessageId: 'msg_user_1',
  at: Date.UTC(2026, 0, 15, 10, 30),
  prompt: 'Pedido inicial',
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
 * Detalle expandido de un turno (FR-033): prompt completo, cita/evidencia del
 * `user` que abrió el turno y señales. Es presentación pura y solo se monta
 * desde la fila o tarjeta expandida, así que aquí se prueba aislado.
 */
describe('EfficiencyTurnDetail', () => {
  it('muestra el prompt completo sin recortar', () => {
    const prompt = `${'a'.repeat(130)}COLA-VISIBLE`;
    render(<EfficiencyTurnDetail turn={makeTurn({ prompt })} />);

    expect(screen.getByText(prompt)).toBeInTheDocument();
    expect(screen.queryByText('a'.repeat(120))).not.toBeInTheDocument();
  });

  it('muestra la evidencia con turno, mensaje y hora', () => {
    const turn = makeTurn();
    render(<EfficiencyTurnDetail turn={turn} />);

    expect(screen.getByText(/Evidencia/)).toBeInTheDocument();
    const evidence = screen.getByText(
      new RegExp(
        `Turno 1.*${turn.userMessageId}.*${formatClock(turn.at)}`,
        's',
      ),
    );
    expect(evidence).toBeInTheDocument();
  });

  it('lista las señales del turno con su identificador', () => {
    render(
      <EfficiencyTurnDetail
        turn={makeTurn({ signals: ['INP-1', 'RES-2'] })}
      />,
    );

    expect(screen.getByText(/Señales del turno/)).toBeInTheDocument();
    const signals = screen.getAllByRole('listitem');
    expect(signals).toHaveLength(2);
    expect(signals[0]).toHaveTextContent('INP-1');
    expect(signals[0]).toHaveTextContent('Pedidos consecutivos similares');
    expect(signals[1]).toHaveTextContent('RES-2');
  });

  it('declara "Sin señales" cuando el turno no tiene ninguna', () => {
    render(<EfficiencyTurnDetail turn={makeTurn({ signals: [] })} />);

    expect(screen.getByText('Sin señales')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('no inventa un cierre en el turno abierto', () => {
    render(
      <EfficiencyTurnDetail
        turn={makeTurn({ closed: false, outcome: null, durationMs: null })}
      />,
    );

    expect(screen.getByText('Pedido inicial')).toBeInTheDocument();
    expect(screen.queryByText(/Éxito|Fallo|Interrumpido/)).not.toBeInTheDocument();
  });
});
