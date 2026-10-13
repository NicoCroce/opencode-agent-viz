import { describe, expect, it } from 'vitest';
import type {
  TGraphNode,
  TParallelGroup,
  TNodeStatus,
} from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import {
  deriveGroupSpeedup,
  deriveSessionSpeedup,
  deriveSpeedupByNode,
} from '../metrics/speedup';

const node = (
  id: string,
  {
    status = 'succeeded',
    durationMs = 100,
    createdAt = 0,
    updatedAt = 100,
  }: {
    status?: TNodeStatus;
    durationMs?: number | null;
    createdAt?: number;
    updatedAt?: number | null;
  } = {},
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: id,
    createdAt,
    updatedAt,
    agentName: 'develop',
    directory: '/repo',
    model: null,
    status,
    retry: null,
    interruptReason: null,
    metrics: { ...EMPTY_METRICS, durationMs },
    isRoot: false,
    currentTool: null,
    parallel: null,
  },
});

const group = (overrides: Partial<TParallelGroup> = {}): TParallelGroup => ({
  id: 'g1',
  parentId: 'root',
  nodeIds: ['a', 'b'],
  startedAt: 0,
  endedAt: 100,
  ...overrides,
});

describe('deriveGroupSpeedup · P1..P5', () => {
  it('calcula serial/wall/speedup/efficiency', () => {
    const byId = new Map([
      ['a', node('a')],
      ['b', node('b')],
    ]);

    const result = deriveGroupSpeedup(group(), byId, 0);

    expect(result.serialMs).toBe(200);
    expect(result.wallMs).toBe(100);
    expect(result.speedup).toBeCloseTo(2, 5);
    expect(result.efficiency).toBeCloseTo(1, 5);
    expect(result.size).toBe(2);
  });

  it('con solape parcial, la aceleración y la eficiencia bajan', () => {
    const byId = new Map([
      ['a', node('a')],
      ['b', node('b')],
    ]);

    const result = deriveGroupSpeedup(group({ endedAt: 150 }), byId, 0);

    expect(result.speedup).toBeCloseTo(200 / 150, 5);
    expect(result.efficiency).toBeCloseTo(200 / 150 / 2, 5);
    expect(result.efficiency as number).toBeLessThan(1);
  });

  it('marca provisional cuando algún miembro está activo', () => {
    const byId = new Map([
      ['a', node('a', { status: 'running', updatedAt: null })],
      ['b', node('b')],
    ]);

    expect(deriveGroupSpeedup(group(), byId, 0).provisional).toBe(true);
  });

  it('devuelve speedup null con wallMs 0', () => {
    const byId = new Map([
      ['a', node('a')],
      ['b', node('b')],
    ]);

    const result = deriveGroupSpeedup(
      group({ startedAt: 10, endedAt: 10 }),
      byId,
      0,
    );

    expect(result.speedup).toBeNull();
    expect(result.efficiency).toBeNull();
  });

  it('devuelve serialMs null cuando falta la duración de un miembro', () => {
    const byId = new Map([
      ['a', node('a')],
      // Ventana 0 (createdAt === updatedAt): sin duración calculable.
      ['b', node('b', { durationMs: null, createdAt: 5, updatedAt: 5 })],
    ]);

    const result = deriveGroupSpeedup(group(), byId, 0);

    expect(result.serialMs).toBeNull();
    expect(result.speedup).toBeNull();
  });
});

describe('deriveSpeedupByNode', () => {
  it('adjunta el resumen del grupo a cada miembro y solo a ellos', () => {
    const model = {
      nodes: [node('a'), node('b'), node('c')],
      edges: [],
    };

    const byNode = deriveSpeedupByNode(model, [group()], 0);

    expect(Object.keys(byNode).sort()).toEqual(['a', 'b']);
    expect(byNode.a.groupId).toBe('g1');
    expect(byNode.a.size).toBe(2);
    expect(byNode.a.serialMs).toBe(200);
    expect(byNode.a.wallMs).toBe(100);
    expect(byNode.c).toBeUndefined();
  });
});

describe('deriveSessionSpeedup · P6', () => {
  it('usa la unión de intervalos, no la suma bruta de ventanas', () => {
    const model = {
      nodes: [
        node('a', { durationMs: 100, createdAt: 0, updatedAt: 100 }),
        node('b', { durationMs: 100, createdAt: 50, updatedAt: 150 }),
      ],
      edges: [],
    };

    const result = deriveSessionSpeedup(model, 0);

    expect(result.serialMs).toBe(200);
    expect(result.wallMs).toBe(150);
    expect(result.speedup).toBeCloseTo(200 / 150, 5);
  });

  it('sin nodos, todo es null', () => {
    const result = deriveSessionSpeedup({ nodes: [], edges: [] }, 0);

    expect(result).toEqual({ serialMs: null, wallMs: null, speedup: null });
  });
});
