import { describe, expect, it } from 'vitest';
import type { TGraphNode, TGraphNodeData } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { enrichNodeData } from '../enrichNodeData';
import { assistantMessage, idleStatus } from './fixtures';

const node = (overrides: Partial<TGraphNodeData> = {}): TGraphNode => ({
  id: 'ses-1',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'ses-1',
    title: 'tarea',
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
  },
});

/** Respuesta assistant con `streamed`/`completed` a partir de un `totalMs`. */
const response = (id: string, created: number, totalMs: number) =>
  assistantMessage({
    id,
    time: { created, streamed: created + 50, completed: created + totalMs },
  });

const enrich = (
  messages: ReturnType<typeof assistantMessage>[],
  options: { threshold?: number; agentMedianMs?: number | null } = {},
) =>
  enrichNodeData({
    node: node(),
    messages,
    permissions: [],
    formDetails: [],
    signal: undefined,
    sessionStatus: idleStatus,
    now: 0,
    ...options,
  });

describe('enrichNodeData — latencia (T042, FR-018..FR-023)', () => {
  it('puebla context.latency con la serie y la mediana del nodo', () => {
    const data = enrich([
      response('a1', 0, 1000),
      response('a2', 1000, 1100),
      response('a3', 2000, 1200),
    ]);

    expect(data.context?.latency?.samples).toHaveLength(3);
    expect(data.context?.latency?.samples[0]).toEqual({
      stepId: 'a1',
      startedAt: 0,
      generationMs: 50,
      totalMs: 1000,
    });
    expect(data.context?.latency?.medianMs).toBe(1100);
    expect(data.context?.latency?.reference).toBe('node');
    expect(data.context?.latency?.anomalies).toEqual([]);
  });

  it('usa la mediana del agente cuando el nodo no tiene historial propio', () => {
    const data = enrich([response('a1', 0, 3000)], { agentMedianMs: 1000 });

    expect(data.context?.latency?.reference).toBe('agent');
    expect(data.context?.latency?.medianMs).toBe(1000);
    expect(data.context?.latency?.anomalies).toHaveLength(1);
    expect(data.context?.latency?.anomalies[0]).toMatchObject({
      stepId: 'a1',
      direction: 'slow',
      reference: 'agent',
    });
  });

  it('recalcula las anomalías según el umbral (FR-022)', () => {
    const slow = enrich([response('a1', 0, 1500)], {
      agentMedianMs: 1000,
      threshold: 0.4,
    });
    expect(slow.context?.latency?.anomalies).toHaveLength(1);

    const tolerant = enrich([response('a1', 0, 1500)], {
      agentMedianMs: 1000,
      threshold: 0.9,
    });
    expect(tolerant.context?.latency?.anomalies).toEqual([]);
  });

  it('sin mensajes, la serie queda vacía y sin anomalías', () => {
    const data = enrich([]);

    expect(data.context?.latency?.samples).toEqual([]);
    expect(data.context?.latency?.medianMs).toBeNull();
    expect(data.context?.latency?.anomalies).toEqual([]);
  });
});
