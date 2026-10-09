import { describe, expect, it } from 'vitest';
import type {
  TGraphEdge,
  TGraphModel,
  TGraphNode,
  TNodeStatus,
  TParallelGroup,
} from '../../Graph.entity';
import type { TExecutionPlan } from '../execution/deriveExecutionLevels';
import { EFFORT_SHAPE_CHILDREN, EFFORT_SHAPE_INVOCATIONS } from '../effort/constants';
import { deriveEffortByNode } from '../effort/deriveEffort';

interface NodeOptions {
  durationMs?: number | null;
  status?: TNodeStatus;
  invocations?: number;
}

const node = (id: string, options: NodeOptions = {}): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: options.status ?? 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: options.durationMs ?? null,
      startedAt: null,
      endedAt: null,
      cost: null,
      tokens: null,
      invocations: options.invocations ?? 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: false,
    currentTool: null,
    parallel: null,
  },
});

const model = (
  nodes: TGraphNode[],
  parentByChild: Record<string, string> = {},
): TGraphModel => ({
  nodes,
  edges: Object.entries(parentByChild).map(([target, source]): TGraphEdge => ({
    id: `${source}->${target}`,
    source,
    target,
    type: 'agent',
  })),
});

/** Plan mínimo: solo `levelByNode` (la línea = tanda de ejecución) importa aquí. */
const plan = (levelByNode: Record<string, number>): TExecutionPlan => ({
  levels: [],
  levelByNode,
  columnByNode: {},
  width: 0,
});

const group = (parentId: string | null, nodeIds: string[]): TParallelGroup => ({
  id: `${parentId ?? 'root'}#${nodeIds.join(',')}`,
  parentId,
  nodeIds,
  startedAt: 0,
  endedAt: 0,
});

describe('deriveEffortByNode', () => {
  it('S1: sin paralelos ni desviación de duración devuelve el nivel base 1', () => {
    const graph = model([
      node('a', { durationMs: 100 }),
      node('b', { durationMs: 100 }),
    ]);

    const result = deriveEffortByNode(graph, plan({ a: 0, b: 0 }), []);

    expect(result.a.level).toBe(1);
    expect(result.b.level).toBe(1);
    expect(result.a.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it('S2: lanzar paralelos (parentId de un grupo con ≥2) suma +1', () => {
    const graph = model(
      [node('orchestrator'), node('c1'), node('c2')],
      { c1: 'orchestrator', c2: 'orchestrator' },
    );
    const groups = [group('orchestrator', ['c1', 'c2'])];

    const result = deriveEffortByNode(
      graph,
      plan({ orchestrator: 0, c1: 1, c2: 1 }),
      groups,
    );

    expect(result.orchestrator.level).toBe(2);
    expect(result.c1.level).toBe(1);
    expect(result.c2.level).toBe(1);
  });

  it('S2: un grupo de un solo nodo no cuenta como lanzar paralelos', () => {
    const graph = model(
      [node('orchestrator'), node('c1')],
      { c1: 'orchestrator' },
    );

    const result = deriveEffortByNode(
      graph,
      plan({ orchestrator: 0, c1: 1 }),
      [group('orchestrator', ['c1'])],
    );

    expect(result.orchestrator.level).toBe(1);
  });

  it('S3: superar 2× el más rápido de la misma tanda suma +1', () => {
    const graph = model([
      node('fast', { durationMs: 100 }),
      node('slow', { durationMs: 300 }),
    ]);

    const result = deriveEffortByNode(graph, plan({ fast: 1, slow: 1 }), []);

    expect(result.fast.level).toBe(1);
    expect(result.slow.level).toBe(2);
  });

  it('S3: justo 2× no suma; por encima de 2× sí', () => {
    const atBoundary = deriveEffortByNode(
      model([
        node('fast', { durationMs: 100 }),
        node('edge', { durationMs: 200 }),
      ]),
      plan({ fast: 1, edge: 1 }),
      [],
    );
    const aboveBoundary = deriveEffortByNode(
      model([
        node('fast', { durationMs: 100 }),
        node('edge', { durationMs: 201 }),
      ]),
      plan({ fast: 1, edge: 1 }),
      [],
    );

    expect(atBoundary.edge.level).toBe(1);
    expect(aboveBoundary.edge.level).toBe(2);
  });

  it('S3: la comparación es dentro de la línea (tanda), no entre líneas', () => {
    const graph = model([
      node('fastOtherLine', { durationMs: 10 }),
      node('slowOtherLine', { durationMs: 900 }),
    ]);

    // Cada nodo en su propia tanda: el más rápido de cada línea es él mismo.
    const result = deriveEffortByNode(
      graph,
      plan({ fastOtherLine: 0, slowOtherLine: 1 }),
      [],
    );

    expect(result.fastOtherLine.level).toBe(1);
    expect(result.slowOtherLine.level).toBe(1);
  });

  it('S4: forma alta suma hasta +2 (hijos e invocaciones)', () => {
    const childIds = Array.from(
      { length: EFFORT_SHAPE_CHILDREN },
      (_, index) => `k${index}`,
    );
    const graph = model(
      [
        node('big', { invocations: EFFORT_SHAPE_INVOCATIONS }),
        ...childIds.map((id) => node(id)),
      ],
      Object.fromEntries(
        childIds.map((id): [string, string] => [id, 'big']),
      ),
    );

    const result = deriveEffortByNode(
      graph,
      plan({
        big: 0,
        ...Object.fromEntries(
          childIds.map((id): [string, number] => [id, 1]),
        ),
      }),
      [],
    );

    expect(result.big.level).toBe(3);
  });

  it('S4: con todas las condiciones el nivel llega a 5 y nunca lo supera', () => {
    const graph = model(
      [
        node('big', { invocations: EFFORT_SHAPE_INVOCATIONS, durationMs: 400 }),
        node('fast', { durationMs: 100 }),
        node('k1'),
        node('k2'),
        node('k3'),
      ],
      { k1: 'big', k2: 'big', k3: 'big' },
    );
    const groups = [group('big', ['k1', 'k2', 'k3'])];

    const result = deriveEffortByNode(
      graph,
      plan({ big: 1, fast: 1, k1: 2, k2: 2, k3: 2 }),
      groups,
    );

    expect(result.big.level).toBe(5);
    expect(result.big.level).toBeLessThanOrEqual(5);
  });

  it('S5: una línea de un solo nodo no infla el nivel', () => {
    const graph = model([node('solo', { durationMs: 500 })]);

    const result = deriveEffortByNode(graph, plan({ solo: 0 }), []);

    expect(result.solo.level).toBe(1);
  });

  it('S5: el único con duración en su línea tampoco se infla', () => {
    const graph = model([
      node('timed', { durationMs: 500 }),
      node('untimed'),
    ]);

    const result = deriveEffortByNode(graph, plan({ timed: 0, untimed: 0 }), []);

    expect(result.timed.level).toBe(1);
    expect(result.untimed.level).toBe(1);
  });

  it('S6: duración ausente no deja el nivel indefinido (base 1 garantizado)', () => {
    const graph = model([node('a')]);

    const result = deriveEffortByNode(graph, plan({ a: 0 }), []);

    expect(result.a).toBeDefined();
    expect(result.a.level).toBe(1);
  });

  it('S6: las duraciones ausentes no penalizan a los nodos de la línea', () => {
    const graph = model([
      node('a', { durationMs: null }),
      node('b', { durationMs: null }),
    ]);

    const result = deriveEffortByNode(graph, plan({ a: 1, b: 1 }), []);

    expect(result.a.level).toBe(1);
    expect(result.b.level).toBe(1);
  });

  it('S7: provisional es verdadero si la línea tiene algún nodo activo', () => {
    const graph = model([
      node('active', { status: 'running' }),
      node('closed', { status: 'succeeded' }),
    ]);

    const result = deriveEffortByNode(
      graph,
      plan({ active: 0, closed: 0 }),
      [],
    );

    expect(result.active.provisional).toBe(true);
    expect(result.closed.provisional).toBe(true);
  });

  it('S7: provisional es falso cuando la línea está cerrada', () => {
    const graph = model([
      node('a', { status: 'succeeded' }),
      node('b', { status: 'failed' }),
    ]);

    const result = deriveEffortByNode(graph, plan({ a: 0, b: 0 }), []);

    expect(result.a.provisional).toBe(false);
    expect(result.b.provisional).toBe(false);
  });

  it('S7: un nodo activo es provisional aunque su línea no tenga otros activos', () => {
    const graph = model([
      node('active', { status: 'compacting' }),
      node('otherLine', { status: 'succeeded' }),
    ]);

    const result = deriveEffortByNode(
      graph,
      plan({ active: 0, otherLine: 1 }),
      [],
    );

    expect(result.active.provisional).toBe(true);
    expect(result.otherLine.provisional).toBe(false);
  });

  it('devuelve una entrada por nodo (nivel base garantizado en todo el modelo)', () => {
    const graph = model([node('a'), node('b'), node('c')]);

    const result = deriveEffortByNode(
      graph,
      plan({ a: 0, b: 1, c: 2 }),
      [],
    );

    expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) {
      expect(result[id].level).toBeGreaterThanOrEqual(1);
      expect(result[id].reasons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('S4: justo por debajo de los umbrales de forma no suma nada', () => {
    // 2 hijos (< EFFORT_SHAPE_CHILDREN) y 4 invocaciones (< umbral): la forma
    // alta solo cuenta a partir del umbral de `constants.ts`.
    const graph = model(
      [
        node('small', { invocations: EFFORT_SHAPE_INVOCATIONS - 1 }),
        node('k0'),
        node('k1'),
      ],
      { k0: 'small', k1: 'small' },
    );

    const result = deriveEffortByNode(
      graph,
      plan({ small: 0, k0: 1, k1: 1 }),
      [],
    );

    expect(EFFORT_SHAPE_CHILDREN).toBeGreaterThan(2);
    expect(result.small.level).toBe(1);
    expect(result.small.reasons).toHaveLength(1);
  });

  it('S4: con todas las condiciones el motivo enumera los 5 aportes en orden', () => {
    const graph = model(
      [
        node('big', { invocations: EFFORT_SHAPE_INVOCATIONS, durationMs: 400 }),
        node('fast', { durationMs: 100 }),
        node('k1'),
        node('k2'),
        node('k3'),
      ],
      { k1: 'big', k2: 'big', k3: 'big' },
    );

    const result = deriveEffortByNode(
      graph,
      plan({ big: 1, fast: 1, k1: 2, k2: 2, k3: 2 }),
      [group('big', ['k1', 'k2', 'k3'])],
    );

    expect(result.big.level).toBe(5);
    expect(result.big.reasons).toEqual([
      'Nivel base',
      'Lanza agentes en paralelo',
      'Duración superior al doble de su línea',
      'Delega en varios agentes',
      'Muchas invocaciones de herramientas',
    ]);
  });

  it('S1: un nodo sin condiciones solo enumera el motivo base', () => {
    const graph = model([node('plain', { durationMs: 100 })]);

    const result = deriveEffortByNode(graph, plan({ plain: 0 }), []);

    expect(result.plain.level).toBe(1);
    expect(result.plain.reasons).toEqual(['Nivel base']);
  });

  it('S6: una duración 0 o negativa no es el mínimo de la línea ni infla al resto', () => {
    // Si la duración inválida (≤0) contara como mínimo, `slow` superaría 2×0 y
    // subiría artificialmente. El contrato solo usa duraciones `> 0`.
    const graph = model([
      node('zero', { durationMs: 0 }),
      node('negative', { durationMs: -10 }),
      node('slow', { durationMs: 500 }),
    ]);

    const result = deriveEffortByNode(
      graph,
      plan({ zero: 1, negative: 1, slow: 1 }),
      [],
    );

    expect(result.zero.level).toBe(1);
    expect(result.negative.level).toBe(1);
    expect(result.slow.level).toBe(1);
  });

  it('S2: un grupo con `parentId` null (lote de la raíz) no concede el bonus de paralelos', () => {
    const graph = model([node('a'), node('b')]);

    const result = deriveEffortByNode(
      graph,
      plan({ a: 0, b: 0 }),
      [group(null, ['a', 'b'])],
    );

    expect(result.a.level).toBe(1);
    expect(result.b.level).toBe(1);
  });
});
