import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { EMPTY_METRICS } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '../../../queryKeys';
import { useContextMetrics } from '../useContextMetrics';

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: { getSessionMessages: vi.fn() },
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
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(
    queryKeys.sessions.messages(invokedBy?.data.sessionId ?? 'none'),
    parentMessages,
  );
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
