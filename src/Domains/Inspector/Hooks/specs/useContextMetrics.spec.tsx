import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ModelInfo } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  TGraphNode,
  TNodeContextMetrics,
} from '@app/Domains/Graph/Graph.entity';
import { EMPTY_METRICS } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '../../../queryKeys';
import { useContextMetrics } from '../useContextMetrics';

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    getSessionMessages: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

const node = (sessionId: string, overrides: Partial<TGraphNode['data']> = {}): TGraphNode => ({
  id: sessionId,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId,
    title: sessionId,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: null,
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: { ...EMPTY_METRICS },
    isRoot: false,
    currentTool: null,
    parallel: null,
    ...overrides,
  },
});

const spawnMessage = (childSessionId: string): TSessionMessage => {
  const parts: TSessionMessage['parts'] = [
    {
      type: 'tool',
      id: 'tool-1',
      name: 'subagent',
      state: {
        status: 'completed',
        input: {},
        content: [{ type: 'text', text: 'resultado del hijo' }],
        metadata: { sessionID: childSessionId },
      },
      time: { created: 0, completed: 1 },
    },
  ];
  return {
    info: {
      id: 'a1',
      type: 'assistant',
      agent: 'develop',
      model: { id: 'm', providerID: 'p' },
      time: { created: 0, completed: 1 },
      content: parts,
    },
    parts,
  };
};

const renderMetrics = (
  inspected: TGraphNode | null,
  invokedBy: TGraphNode | null,
  parentMessages: TSessionMessage[] = [],
  models?: ModelInfo[],
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(
    queryKeys.sessions.messages(invokedBy?.data.sessionId ?? 'none'),
    parentMessages,
  );
  if (models) queryClient.setQueryData(queryKeys.models.list('/repo'), models);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useContextMetrics(inspected, invokedBy), { wrapper });
};

describe('useContextMetrics · S4 (aporte al padre)', () => {
  it('expone el contexto del nodo y el aporte al padre', () => {
    const child = node('child');
    const parent = node('parent');

    const { result } = renderMetrics(child, parent, [spawnMessage('child')]);

    expect(result.current.parentId).toBe('parent');
    expect(result.current.parentImpact?.addedChars).toBe(
      'resultado del hijo'.length,
    );
    expect(result.current.parentImpact?.parentId).toBe('parent');
  });

  it('sin padre, no hay parentImpact ni parentId', () => {
    const child = node('child');

    const { result } = renderMetrics(child, null);

    expect(result.current.parentId).toBeNull();
    expect(result.current.parentImpact).toBeNull();
  });

  it('devuelve el contexto ya derivado del nodo', () => {
    const child = node('child', {
      context: {
        breakdown: {
          buckets: [],
          chars: 0,
          windowTokens: null,
          hasTokens: false,
        },
        window: {
          windowTokens: null,
          cacheRead: null,
          cacheWrite: null,
          hitRate: null,
          costPerKToken: null,
        },
        latency: null,
        provisional: false,
      },
    });

    const { result } = renderMetrics(child, null);

    expect(result.current.context).toBe(child.data.context);
  });
});

const contextWithWindow = (
  windowTokens: number | null,
): TGraphNode['data']['context'] => ({
  breakdown: { buckets: [], chars: 0, windowTokens, hasTokens: false },
  window: {
    windowTokens,
    cacheRead: null,
    cacheWrite: null,
    hitRate: null,
    costPerKToken: null,
  },
  latency: null,
  provisional: false,
});

const catalogModel = (id: string, providerID: string, context: number) =>
  ({ id, modelID: id, providerID, limit: { context, output: 8_000 } }) as ModelInfo;

describe('useContextMetrics · uso de la ventana frente al límite del modelo', () => {
  it('cruza el modelo del nodo con el catálogo de su directorio', () => {
    const inspected = node('child', {
      model: { id: 'opus', providerID: 'anthropic', variant: 'high' },
      context: contextWithWindow(50_000),
    });

    const { result } = renderMetrics(inspected, null, [], [
      catalogModel('haiku', 'anthropic', 100_000),
      catalogModel('opus', 'anthropic', 200_000),
    ]);

    expect(result.current.usage).toEqual({
      usedTokens: 50_000,
      limitTokens: 200_000,
      ratio: 0.25,
    });
  });

  it('sin el modelo en el catálogo no inventa un porcentaje', () => {
    const inspected = node('child', {
      model: { id: 'desconocido', providerID: 'anthropic' },
      context: contextWithWindow(50_000),
    });

    const { result } = renderMetrics(inspected, null, [], [
      catalogModel('opus', 'anthropic', 200_000),
    ]);

    expect(result.current.usage).toBeNull();
  });

  it('sin ventana medida no hay uso aunque el límite se conozca', () => {
    const inspected = node('child', {
      model: { id: 'opus', providerID: 'anthropic' },
      context: contextWithWindow(null),
    });

    const { result } = renderMetrics(inspected, null, [], [
      catalogModel('opus', 'anthropic', 200_000),
    ]);

    expect(result.current.usage).toBeNull();
  });
});

describe('useContextMetrics · bucle de compactación', () => {
  const withCompactions = (
    growthTimes: number[],
    compactionTimes: number[],
  ): TGraphNode['data']['context'] => ({
    ...(contextWithWindow(16_000) as TNodeContextMetrics),
    growth: growthTimes.map((startedAt, index) => ({
      stepId: `a${index}`,
      startedAt,
      windowTokens: 16_000,
    })),
    compactions: compactionTimes.map((at, index) => ({
      id: `c${index}`,
      at,
      status: 'completed' as const,
      reason: 'auto' as const,
    })),
  });

  it('detecta compactaciones tras casi cada respuesta', () => {
    const inspected = node('child', {
      context: withCompactions([15, 25, 35], [10, 20, 30, 40]),
    });

    const { result } = renderMetrics(inspected, null);

    expect(result.current.compactionLoop).toEqual({ compactions: 4, steps: 3 });
  });

  it('sin compactaciones seguidas no informa bucle', () => {
    const inspected = node('child', {
      context: withCompactions([11, 12, 13, 21, 22, 23], [10, 20, 30]),
    });

    const { result } = renderMetrics(inspected, null);

    expect(result.current.compactionLoop).toBeNull();
  });
});
