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
      data({
        title:
          'Definiciones de ejecuciones multi subagentes en Speckit y despliegue extendido de la vista',
      }),
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

    // El esfuerzo se ancla a la esquina inferior derecha del card: no debe
    // cambiar la altura estimada del card.
    expect(cardHeight(withEffort, NODE_WIDTH)).toBe(
      cardHeight(data(), NODE_WIDTH),
    );
  });

  it('el encabezado vuelve a reservar solo el estado y el badge (72 px)', () => {
    // El medidor de esfuerzo se ancla al pie, así que el encabezado ya no
    // reserva su ancho: la reserva vuelve a la base (estado + badge de
    // paralelos). `EFFORT_METER_WIDTH` sigue siendo el ancho real del medidor
    // (referencia del canal derecho `pr-7` del pie).
    expect(EFFORT_METER_WIDTH).toBeGreaterThan(0);
    expect(STATUS_WIDTH).toBe(72);
  });

  it('estima las líneas del título contra la reserva base del encabezado (72 px)', () => {
    // Contenido pesado para superar el alto mínimo y aislar las líneas del
    // título (modelo + herramienta en curso + reintento).
    const heavy = data({
      model: { providerID: 'opencode-go', id: 'deepseek-v4.1-flash' },
      currentTool: { name: 'bash', state: 'running' },
      retry: { attempt: 2, next: null },
    });
    // Con el ancho base (340 px) y la reserva base (72 px) el ancho útil del
    // título es ~246 px: 30 caracteres caben en una línea y 60 desbordan a una
    // segunda.
    const fits = cardHeight({ ...heavy, title: 'x'.repeat(30) }, NODE_WIDTH);
    const wraps = cardHeight({ ...heavy, title: 'x'.repeat(60) }, NODE_WIDTH);

    expect(wraps).toBeGreaterThan(fits);
  });
});
