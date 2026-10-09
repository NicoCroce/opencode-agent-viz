import { describe, expect, it } from 'vitest';
import type { TGraphNodeData } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { cardHeight, EFFORT_METER_WIDTH, STATUS_WIDTH } from '../cardHeight';
import { NODE_WIDTH } from '../layoutGraph';
import { MIN_NODE_HEIGHT } from '../nodeResize';

const data = (overrides: Partial<TGraphNodeData> = {}): TGraphNodeData => ({
  sessionId: 'root',
  title: 'Tarea corta',
  createdAt: null,
  updatedAt: null,
  agentName: 'develop',
  directory: '/repo',
  model: null,
  status: 'succeeded',
  retry: null,
  interruptReason: null,
  metrics: { ...EMPTY_METRICS },
  isRoot: true,
  currentTool: null,
  parallel: null,
  ...overrides,
});

describe('cardHeight', () => {
  it('grows when the model line is present', () => {
    const withoutModel = cardHeight(data(), NODE_WIDTH);
    const withModel = cardHeight(
      data({
        model: { providerID: 'opencode-go', id: 'deepseek-v4.1-flash' },
      }),
      NODE_WIDTH,
    );

    expect(withModel).toBeGreaterThan(withoutModel);
  });

  it('grows with the current-tool line', () => {
    const withoutTool = cardHeight(data(), NODE_WIDTH);
    const withTool = cardHeight(
      data({ currentTool: { name: 'bash', state: 'running' } }),
      NODE_WIDTH,
    );

    expect(withTool).toBeGreaterThan(withoutTool);
  });

  it('gives a long title two lines and a short title one', () => {
    const short = cardHeight(data({ title: 'Corta' }), NODE_WIDTH);
    const long = cardHeight(
      data({ title: 'Definiciones de ejecuciones multi subajentes en Speckit' }),
      NODE_WIDTH,
    );

    expect(long).toBeGreaterThan(short);
  });

  it('grows with the node width shrinking (longer model wraps)', () => {
    const model = {
      providerID: 'opencode-go',
      id: 'deepseek-v4.1-flash',
    };
    const wide = cardHeight(data({ model }), 420);
    const narrow = cardHeight(data({ model }), 220);

    expect(narrow).toBeGreaterThanOrEqual(wide);
  });

  it('never returns less than the minimum node height', () => {
    expect(cardHeight(data({ title: '' }), NODE_WIDTH)).toBeGreaterThanOrEqual(
      MIN_NODE_HEIGHT,
    );
  });

  it('el medidor de esfuerzo no añade filas al card (S10)', () => {
    const withEffort = data({
      effort: { level: 5, provisional: true, reasons: ['lanzó paralelos'] },
    });

    // El esfuerzo se pinta en la fila existente del encabezado: no debe
    // cambiar la altura estimada del card.
    expect(cardHeight(withEffort, NODE_WIDTH)).toBe(
      cardHeight(data(), NODE_WIDTH),
    );
  });

  it('reserva el ancho del medidor de 5 muescas en la fila del encabezado (T015)', () => {
    // 72 px era el ancho reservado previo (estado + badge de paralelos); el
    // encabezado debe reservar además el medidor, sin recortar el título.
    expect(EFFORT_METER_WIDTH).toBeGreaterThan(0);
    expect(STATUS_WIDTH).toBeGreaterThanOrEqual(72 + EFFORT_METER_WIDTH);
  });

  it('estima las líneas del título contra el ancho reservado actualizado (T015)', () => {
    // Contenido pesado para superar el alto mínimo y aislar las líneas del
    // título (modelo + herramienta en curso + reintento).
    const heavy = data({
      model: { providerID: 'opencode-go', id: 'deepseek-v4.1-flash' },
      currentTool: { name: 'bash', state: 'running' },
      retry: { attempt: 2, next: null },
    });
    // 13 caracteres caben en una línea con el ancho reservado actualizado; 16
    // caracteres desbordan a una segunda línea. Con la reserva previa (72 px)
    // ambos cabían en una línea y el alto no distinguía el wrap.
    const fits = cardHeight({ ...heavy, title: 'x'.repeat(13) }, NODE_WIDTH);
    const wraps = cardHeight({ ...heavy, title: 'x'.repeat(16) }, NODE_WIDTH);

    expect(wraps).toBeGreaterThan(fits);
  });
});
