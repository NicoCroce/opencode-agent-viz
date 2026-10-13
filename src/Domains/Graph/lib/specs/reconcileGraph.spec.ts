import { describe, expect, it } from 'vitest';
import type {
  TContextBreakdown,
  TContextWindow,
  TGraphEdge,
  TGraphNode,
  TGraphNodeData,
  TNodeContextMetrics,
  TNodeEffort,
  TNodeSpeedup,
} from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { reconcileGraphModel } from '../reconcileGraph';
import {
  sameContext,
  sameEffort,
  sameNodeData,
  sameSpeedup,
} from '../reconcile/comparators';

/**
 * Spec del contrato de render (feature 006), criterios C1..C2 de
 * `specs/006-graph-render-performance/contracts/graph-render-contract.md` §1.1.
 *
 * `reconcileGraph.ts` lo implementa T026; hasta entonces este spec falla al
 * resolver el import (ROJO esperado). Describe el comportamiento congelado:
 *  - C1: `reconcileGraphModel` reutiliza el **mismo objeto** de nodo (`===`)
 *        cuando `id`, `position` y `data` (campo a campo) no cambian.
 *  - C2: `edges === prev.edges` si `topologySignature` no cambia; en caso
 *        contrario devuelve `next.edges`.
 *
 * Garantías adicionales del contrato: `prev === null` → `next` tal cual; el
 * array `nodes` es nuevo si algún nodo difiere (y `prev.nodes` si todos se
 * reutilizan en el mismo orden); la función no muta `prev` ni `next`.
 */

/** Nodo de agente con valores estables; los campos que importan se sobrescriben. */
const makeNode = (
  id: string,
  overrides: Partial<Omit<TGraphNode, 'data'>> & {
    data?: Partial<TGraphNodeData>;
  } = {},
): TGraphNode => {
  const { data, ...rest } = overrides;
  return {
    id,
    type: 'agent',
    position: { x: 0, y: 0 },
    ...rest,
    data: {
      sessionId: id,
      title: `tarea ${id}`,
      createdAt: 1,
      updatedAt: 2,
      agentName: 'develop',
      directory: '/repo',
      model: { id: 'deepseek', providerID: 'opencode' },
      status: 'succeeded',
      retry: null,
      interruptReason: null,
      metrics: { ...EMPTY_METRICS },
      isRoot: false,
      currentTool: null,
      parallel: null,
      enrichment: 'ready',
      ...data,
    },
  };
};

/** Arista de invocación con `id` derivado de sus extremos (data-model §1.4). */
const makeEdge = (source: string, target: string): TGraphEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  type: 'agent',
});

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
};

const snapshot = <T>(value: T): string => JSON.stringify(value);

describe('reconcileGraphModel · C1 (identidad de nodos)', () => {
  it('devuelve `next` tal cual cuando `prev` es null', () => {
    const next = {
      nodes: [makeNode('root')],
      edges: [makeEdge('root', 'child')],
    };

    expect(reconcileGraphModel(null, next)).toBe(next);
  });

  it('reutiliza el mismo objeto de nodo cuando id, position y data no cambian', () => {
    const prev = {
      nodes: [makeNode('root'), makeNode('child')],
      edges: [],
    };
    const next = {
      nodes: [makeNode('root'), makeNode('child')],
      edges: [],
    };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes[0]).toBe(prev.nodes[0]);
    expect(result.nodes[1]).toBe(prev.nodes[1]);
  });

  it('empareja los nodos por id, no por índice', () => {
    const prev = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [],
    };
    const next = {
      nodes: [makeNode('b'), makeNode('a')],
      edges: [],
    };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes[0]).toBe(prev.nodes[1]);
    expect(result.nodes[1]).toBe(prev.nodes[0]);
  });

  it('crea un nodo nuevo cuando cambia la position', () => {
    const prev = { nodes: [makeNode('root', { position: { x: 0, y: 0 } })], edges: [] };
    const next = { nodes: [makeNode('root', { position: { x: 40, y: 80 } })], edges: [] };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes[0]).not.toBe(prev.nodes[0]);
    expect(result.nodes[0]).toBe(next.nodes[0]);
  });

  it.each<[string, Partial<TGraphNodeData>]>([
    ['status', { status: 'running' }],
    ['title', { title: 'otro título' }],
    ['createdAt', { createdAt: 10 }],
    ['updatedAt', { updatedAt: 20 }],
    ['agentName', { agentName: 'reviewer' }],
    ['directory', { directory: '/otro' }],
    ['model', { model: { id: 'otro', providerID: 'opencode' } }],
    ['retry', { retry: { attempt: 3, next: 99 } }],
    ['interruptReason', { interruptReason: 'cancelado' }],
    ['isRoot', { isRoot: true }],
    ['currentTool', { currentTool: { name: 'read', state: 'running' } }],
    ['parallel', { parallel: { groupId: 'g1', size: 2 } }],
    ['enrichment', { enrichment: 'pending' }],
    ['metrics.durationMs', { metrics: { ...EMPTY_METRICS, durationMs: 500 } }],
    [
      'metrics.tokens',
      {
        metrics: {
          ...EMPTY_METRICS,
          tokens: {
            input: 1,
            output: 2,
            reasoning: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
        },
      },
    ],
    [
      'metrics.loopEvidence',
      { metrics: { ...EMPTY_METRICS, hasLoop: true, loopEvidence: ['boom'] } },
    ],
  ])('crea un nodo nuevo cuando cambia data.%s', (_label, changed) => {
    const prev = { nodes: [makeNode('root')], edges: [] };
    const next = { nodes: [makeNode('root', { data: changed })], edges: [] };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes[0]).not.toBe(prev.nodes[0]);
  });

  it('crea un nodo nuevo cuando cambia el id', () => {
    const prev = { nodes: [makeNode('root')], edges: [] };
    const next = { nodes: [makeNode('otro')], edges: [] };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes[0]).not.toBe(prev.nodes[0]);
    expect(result.nodes[0]).toBe(next.nodes[0]);
  });

  it('devuelve un array nuevo si algún nodo difiere, preservando los reutilizados', () => {
    const prev = { nodes: [makeNode('a'), makeNode('b')], edges: [] };
    const next = {
      nodes: [makeNode('a'), makeNode('b', { data: { status: 'failed' } })],
      edges: [],
    };

    const result = reconcileGraphModel(prev, next);

    expect(result.nodes).not.toBe(prev.nodes);
    expect(result.nodes[0]).toBe(prev.nodes[0]);
    expect(result.nodes[1]).toBe(next.nodes[1]);
  });

  it('devuelve `prev.nodes` si todos los nodos se reutilizan en el mismo orden', () => {
    const prev = { nodes: [makeNode('a'), makeNode('b')], edges: [] };
    const next = { nodes: [makeNode('a'), makeNode('b')], edges: [] };

    expect(reconcileGraphModel(prev, next).nodes).toBe(prev.nodes);
  });
});

describe('reconcileGraphModel · C2 (estabilidad de aristas)', () => {
  it('reutiliza el array de aristas cuando la topología no cambia', () => {
    const prev = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };
    const next = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };

    expect(reconcileGraphModel(prev, next).edges).toBe(prev.edges);
  });

  it('reutiliza las aristas aunque cambien los datos de los nodos (misma topología)', () => {
    const prev = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };
    const next = {
      nodes: [makeNode('a', { data: { status: 'running' } }), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };

    expect(reconcileGraphModel(prev, next).edges).toBe(prev.edges);
  });

  it('devuelve las aristas de `next` cuando cambia la topología (nodo nuevo)', () => {
    const prev = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };
    const next = {
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
    };

    expect(reconcileGraphModel(prev, next).edges).toBe(next.edges);
  });

  it('devuelve las aristas de `next` cuando cambia la topología (arista nueva)', () => {
    const prev = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
    };
    const next = {
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'a')],
    };

    expect(reconcileGraphModel(prev, next).edges).toBe(next.edges);
  });

  it('con `prev` null devuelve las aristas de `next`', () => {
    const next = {
      nodes: [makeNode('a')],
      edges: [makeEdge('a', 'b')],
    };

    expect(reconcileGraphModel(null, next).edges).toBe(next.edges);
  });
});

describe('reconcileGraphModel · pureza (no muta entradas)', () => {
  it('no muta `prev` ni `next` y es determinista', () => {
    const prev = deepFreeze({
      nodes: [makeNode('a'), makeNode('b', { position: { x: 5, y: 5 } })],
      edges: [makeEdge('a', 'b')],
    });
    const next = deepFreeze({
      nodes: [
        makeNode('a'),
        makeNode('b', { position: { x: 9, y: 9 } }),
        makeNode('c'),
      ],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
    });
    const prevBefore = snapshot(prev);
    const nextBefore = snapshot(next);

    const result = reconcileGraphModel(prev, next);

    expect(snapshot(prev)).toBe(prevBefore);
    expect(snapshot(next)).toBe(nextBefore);
    expect(result.nodes[0]).toBe(prev.nodes[0]);
    expect(result.nodes[1]).toBe(next.nodes[1]);
  });
});

/**
 * S8 de `contracts/effort-contract.md` §4 (data-model §2.1): `effort` debe
 * entrar en `sameNodeData` vía `sameEffort`; sin el comparador el nodo no se
 * reemplazaría y el medidor quedaría congelado. `effort` es opcional, así que
 * `undefined` y `null` son equivalentes (sin esfuerzo) y el paso de ausente a
 * presente debe detectarse.
 */
describe('reconcileGraphModel · S8 (effort en la identidad de nodo)', () => {
  const effort = (
    level: TNodeEffort['level'],
    provisional = false,
    reasons: string[] = [],
  ): TNodeEffort => ({ level, provisional, reasons });

  describe('sameEffort', () => {
    it('trata `undefined` y `null` como equivalentes (sin esfuerzo)', () => {
      expect(sameEffort(undefined, undefined)).toBe(true);
      expect(sameEffort(null, null)).toBe(true);
      expect(sameEffort(undefined, null)).toBe(true);
      expect(sameEffort(null, undefined)).toBe(true);
    });

    it('detecta el paso de ausente a presente y de presente a ausente', () => {
      expect(sameEffort(undefined, effort(1))).toBe(false);
      expect(sameEffort(null, effort(1))).toBe(false);
      expect(sameEffort(effort(1), undefined)).toBe(false);
      expect(sameEffort(effort(1), null)).toBe(false);
    });

    it('detecta cambios de level', () => {
      expect(sameEffort(effort(2), effort(3))).toBe(false);
      expect(sameEffort(effort(5), effort(1))).toBe(false);
    });

    it('detecta cambios de provisional', () => {
      expect(sameEffort(effort(2, false), effort(2, true))).toBe(false);
      expect(sameEffort(effort(2, true), effort(2, false))).toBe(false);
    });

    it('detecta cambios de reasons (longitud y contenido)', () => {
      expect(sameEffort(effort(2, false, ['a']), effort(2, false, []))).toBe(false);
      expect(
        sameEffort(effort(2, false, ['a']), effort(2, false, ['a', 'b'])),
      ).toBe(false);
      expect(
        sameEffort(effort(2, false, ['a', 'b']), effort(2, false, ['b', 'a'])),
      ).toBe(false);
    });

    it('es verdadero con el mismo contenido aunque cambie la identidad', () => {
      expect(sameEffort(effort(3), effort(3))).toBe(true);
      expect(
        sameEffort(effort(4, true, ['paralelos']), effort(4, true, ['paralelos'])),
      ).toBe(true);
    });
  });

  describe('sameNodeData', () => {
    it('no distingue dos nodos sin `effort` (undefined vs ausente)', () => {
      const withUndefined = makeNode('root', { data: { effort: undefined } });
      const withoutField = makeNode('root');

      expect(sameNodeData(withUndefined.data, withoutField.data)).toBe(true);
    });

    it('propaga el cambio de level al reconciliar (el medidor deja de congelarse)', () => {
      const prev = {
        nodes: [makeNode('root', { data: { effort: effort(1) } })],
        edges: [],
      };
      const next = {
        nodes: [makeNode('root', { data: { effort: effort(2) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
      expect(result.nodes[0]).toBe(next.nodes[0]);
    });

    it('propaga el cambio de provisional', () => {
      const prev = {
        nodes: [makeNode('root', { data: { effort: effort(2, false) } })],
        edges: [],
      };
      const next = {
        nodes: [makeNode('root', { data: { effort: effort(2, true) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
      expect(result.nodes[0]).toBe(next.nodes[0]);
    });

    it('propaga el cambio de reasons', () => {
      const prev = {
        nodes: [makeNode('root', { data: { effort: effort(3, false, ['a']) } })],
        edges: [],
      };
      const next = {
        nodes: [makeNode('root', { data: { effort: effort(3, false, ['a', 'b']) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
      expect(result.nodes[0]).toBe(next.nodes[0]);
    });

    it('propaga el paso de ausente a presente', () => {
      const prev = { nodes: [makeNode('root')], edges: [] };
      const next = {
        nodes: [makeNode('root', { data: { effort: effort(4) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
      expect(result.nodes[0]).toBe(next.nodes[0]);
    });

    it('reutiliza el mismo objeto de nodo cuando el `effort` no cambia', () => {
      const prev = {
        nodes: [makeNode('root', { data: { effort: effort(2, true, ['x']) } })],
        edges: [],
      };
      const next = {
        nodes: [makeNode('root', { data: { effort: effort(2, true, ['x']) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).toBe(prev.nodes[0]);
      expect(result.nodes).toBe(prev.nodes);
    });

    it('reutiliza el mismo objeto cuando ambos carecen de `effort`', () => {
      const prev = { nodes: [makeNode('root')], edges: [] };
      const next = { nodes: [makeNode('root')], edges: [] };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).toBe(prev.nodes[0]);
      expect(result.nodes).toBe(prev.nodes);
    });
  });
});

/**
 * Contexto y aceleración en la identidad de nodo (data-model §7;
 * `contracts/context-metrics-contract.md` §5 y `parallel-speedup-contract.md` §5):
 * `context` y `speedup` deben entrar en `sameNodeData` o el nodo no se reemplaza
 * y el panel/badge quedan congelados. Ambos son opcionales.
 */
describe('reconcileGraphModel · contexto y speedup en la identidad de nodo', () => {
  const makeBreakdown = (chars = 100): TContextBreakdown => ({
    buckets: [{ category: 'toolResult', chars, tokens: 10, pct: 100 }],
    chars,
    windowTokens: 10,
    hasTokens: true,
  });

  const makeWindow = (): TContextWindow => ({
    windowTokens: 10,
    cacheRead: 2,
    cacheWrite: 1,
    hitRate: 0.2,
    costPerKToken: 0.01,
  });

  const makeContext = (
    overrides: Partial<TNodeContextMetrics> = {},
  ): TNodeContextMetrics => ({
    breakdown: makeBreakdown(),
    window: makeWindow(),
    latency: null,
    provisional: false,
    ...overrides,
  });

  const makeSpeedup = (overrides: Partial<TNodeSpeedup> = {}): TNodeSpeedup => ({
    groupId: 'g1',
    size: 2,
    serialMs: 200,
    wallMs: 100,
    speedup: 1.8,
    efficiency: 0.9,
    provisional: false,
    ...overrides,
  });

  describe('sameContext', () => {
    it('trata `undefined` y `null` como equivalentes (sin contexto)', () => {
      expect(sameContext(undefined, undefined)).toBe(true);
      expect(sameContext(null, null)).toBe(true);
      expect(sameContext(undefined, null)).toBe(true);
      expect(sameContext(null, undefined)).toBe(true);
    });

    it('detecta el paso de ausente a presente', () => {
      expect(sameContext(undefined, makeContext())).toBe(false);
      expect(sameContext(makeContext(), null)).toBe(false);
    });

    it('detecta cambios de breakdown (chars, buckets y windowTokens)', () => {
      expect(
        sameContext(makeContext(), makeContext({ breakdown: makeBreakdown(200) })),
      ).toBe(false);
    });

    it('detecta cambios de window (hitRate)', () => {
      expect(
        sameContext(
          makeContext(),
          makeContext({ window: { ...makeWindow(), hitRate: 0.5 } }),
        ),
      ).toBe(false);
    });

    it('detecta cambios de provisional', () => {
      expect(
        sameContext(makeContext(), makeContext({ provisional: true })),
      ).toBe(false);
    });

    it('detecta cambios de latencia', () => {
      expect(
        sameContext(
          makeContext(),
          makeContext({
            latency: {
              samples: [
                { stepId: 's1', startedAt: 1, ttftMs: 10, totalMs: 20 },
              ],
              medianMs: 20,
              reference: 'node',
              anomalies: [],
            },
          }),
        ),
      ).toBe(false);
    });

    it('detecta cambios de la evolución (growth)', () => {
      expect(
        sameContext(
          makeContext(),
          makeContext({
            growth: [{ stepId: 'a1', startedAt: 1, windowTokens: 100 }],
          }),
        ),
      ).toBe(false);
    });

    it('trata `undefined` y `[]` como equivalentes en growth', () => {
      expect(
        sameContext(makeContext({ growth: [] }), makeContext({ growth: undefined })),
      ).toBe(true);
    });

    it('detecta cambios de las compactaciones', () => {
      expect(
        sameContext(
          makeContext(),
          makeContext({
            compactions: [
              { id: 'c1', at: 5, status: 'completed', reason: 'auto' },
            ],
          }),
        ),
      ).toBe(false);
    });

    it('detecta cambios en el estado o motivo de una compactación', () => {
      const base = makeContext({
        compactions: [{ id: 'c1', at: 5, status: 'completed', reason: 'auto' }],
      });
      expect(
        sameContext(
          base,
          makeContext({
            compactions: [{ id: 'c1', at: 5, status: 'failed', reason: 'auto' }],
          }),
        ),
      ).toBe(false);
      expect(
        sameContext(
          base,
          makeContext({
            compactions: [{ id: 'c1', at: 5, status: 'completed', reason: 'manual' }],
          }),
        ),
      ).toBe(false);
    });

    it('trata `undefined` y `[]` como equivalentes en compactions', () => {
      expect(
        sameContext(
          makeContext({ compactions: [] }),
          makeContext({ compactions: undefined }),
        ),
      ).toBe(true);
    });

    it('es verdadero con el mismo contenido aunque cambie la identidad', () => {
      expect(sameContext(makeContext(), makeContext())).toBe(true);
    });

    it('es verdadero con growth y compactions equivalentes', () => {
      const growth = [{ stepId: 'a1', startedAt: 1, windowTokens: 100 }];
      const compactions = [
        { id: 'c1', at: 5, status: 'completed' as const, reason: 'auto' as const },
      ];
      expect(
        sameContext(makeContext({ growth, compactions }), makeContext({ growth, compactions })),
      ).toBe(true);
    });
  });

  describe('sameSpeedup', () => {
    it('trata `undefined` y `null` como equivalentes (sin grupo)', () => {
      expect(sameSpeedup(undefined, null)).toBe(true);
      expect(sameSpeedup(null, undefined)).toBe(true);
    });

    it('detecta el paso de ausente a presente', () => {
      expect(sameSpeedup(undefined, makeSpeedup())).toBe(false);
      expect(sameSpeedup(makeSpeedup(), null)).toBe(false);
    });

    it('detecta cambios de speedup, efficiency, size y provisional', () => {
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ speedup: 2.5 }))).toBe(false);
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ efficiency: 0.5 }))).toBe(false);
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ size: 3 }))).toBe(false);
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ serialMs: 400 }))).toBe(
        false,
      );
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ wallMs: 50 }))).toBe(false);
      expect(sameSpeedup(makeSpeedup(), makeSpeedup({ provisional: true }))).toBe(
        false,
      );
    });

    it('es verdadero con el mismo contenido', () => {
      expect(sameSpeedup(makeSpeedup(), makeSpeedup())).toBe(true);
    });
  });

  describe('sameNodeData', () => {
    it('propaga el cambio de context al reconciliar', () => {
      const prev = {
        nodes: [makeNode('root', { data: { context: makeContext() } })],
        edges: [],
      };
      const next = {
        nodes: [
          makeNode('root', {
            data: { context: makeContext({ provisional: true }) },
          }),
        ],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
      expect(result.nodes[0]).toBe(next.nodes[0]);
    });

    it('propaga el cambio de speedup al reconciliar', () => {
      const prev = {
        nodes: [makeNode('root', { data: { speedup: makeSpeedup() } })],
        edges: [],
      };
      const next = {
        nodes: [makeNode('root', { data: { speedup: makeSpeedup({ speedup: 3 }) } })],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).not.toBe(prev.nodes[0]);
    });

    it('reutiliza el mismo objeto cuando context y speedup no cambian', () => {
      const prev = {
        nodes: [
          makeNode('root', {
            data: { context: makeContext(), speedup: makeSpeedup() },
          }),
        ],
        edges: [],
      };
      const next = {
        nodes: [
          makeNode('root', {
            data: { context: makeContext(), speedup: makeSpeedup() },
          }),
        ],
        edges: [],
      };

      const result = reconcileGraphModel(prev, next);

      expect(result.nodes[0]).toBe(prev.nodes[0]);
      expect(result.nodes).toBe(prev.nodes);
    });
  });
});
