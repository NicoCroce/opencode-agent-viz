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

/** Respuesta assistant que genera durante `generationMs` y termina 100 ms después. */
const response = (id: string, created: number, generationMs: number) =>
  assistantMessage({
    id,
    time: {
      created,
      streamed: created + generationMs,
      completed: created + generationMs + 100,
    },
  });

/** Ritmo del modelo de `assistantMessage` (5 tokens ⇒ 1050 ms esperados). */
const PACES = {
  'opencode/deepseek': {
    model: 'opencode/deepseek',
    baseMs: 1000,
    msPerToken: 10,
    samples: 20,
  },
};

const enrich = (
  messages: ReturnType<typeof assistantMessage>[],
  options: { threshold?: number; paces?: typeof PACES } = {},
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
  it('puebla context.latency con la serie y su desglose', () => {
    const data = enrich([
      response('a1', 0, 900),
      response('a2', 1000, 1000),
      response('a3', 2000, 1100),
    ]);

    expect(data.context?.latency?.samples).toHaveLength(3);
    expect(data.context?.latency?.samples[0]).toMatchObject({
      stepId: 'a1',
      startedAt: 0,
      model: 'opencode/deepseek',
      generationMs: 900,
      totalMs: 1000,
      outputTokens: 5,
    });
    expect(data.context?.latency?.anomalies).toEqual([]);
  });

  it('sin ritmo del modelo no hay esperado ni anomalías', () => {
    const data = enrich([response('a1', 0, 60_000)]);

    expect(data.context?.latency?.paces).toEqual([]);
    expect(data.context?.latency?.samples[0].expectedMs).toBeNull();
    expect(data.context?.latency?.anomalies).toEqual([]);
  });

  it('marca lenta la respuesta que tarda mucho más de lo esperado para sus tokens', () => {
    const data = enrich([response('a1', 0, 12_000)], { paces: PACES });

    expect(data.context?.latency?.paces).toEqual([PACES['opencode/deepseek']]);
    expect(data.context?.latency?.samples[0].expectedMs).toBe(1050);
    expect(data.context?.latency?.anomalies).toHaveLength(1);
    expect(data.context?.latency?.anomalies[0]).toMatchObject({
      stepId: 'a1',
      expectedMs: 1050,
      excessMs: 10_950,
    });
  });

  it('recalcula las anomalías según el umbral (FR-022)', () => {
    // 7,1 s sobre 1,05 s esperados: ×6,8.
    const strict = enrich([response('a1', 0, 7100)], { paces: PACES, threshold: 1 });
    expect(strict.context?.latency?.anomalies).toHaveLength(1);

    const tolerant = enrich([response('a1', 0, 7100)], { paces: PACES, threshold: 3 });
    expect(tolerant.context?.latency?.anomalies).toHaveLength(1);

    const notEnough = enrich([response('a1', 0, 4000)], { paces: PACES, threshold: 1 });
    expect(notEnough.context?.latency?.anomalies).toEqual([]);
  });

  it('sin mensajes, la serie queda vacía y sin anomalías', () => {
    const data = enrich([]);

    expect(data.context?.latency?.samples).toEqual([]);
    expect(data.context?.latency?.paces).toEqual([]);
    expect(data.context?.latency?.anomalies).toEqual([]);
  });
});
