import { describe, expect, it } from 'vitest';
import type { TGraphEdge, TGraphNode, TGraphNodeData } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { reconcileGraphModel } from '../reconcileGraph';

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
