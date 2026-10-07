import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SessionLogItem, V2Event } from '@opencode/client';
import { queryKeys } from '../../../queryKeys';
import { reduceEvent } from '../../lib/eventReducer';
import { useExecutionSignals } from '../useExecutionSignals';

const { getSessionLog } = vi.hoisted(() => ({ getSessionLog: vi.fn() }));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: { getSessionLog },
}));

const SESSION_ID = 'ses-1';

const durable = (seq: number) => ({
  aggregateID: SESSION_ID,
  seq,
  version: 1 as const,
});

/* ------------------------------------------------------------------ */
/* Log durable (`session.log`, follow: false)                          */
/* ------------------------------------------------------------------ */

const retryScheduled: SessionLogItem = {
  id: 'evt_retry',
  created: 200,
  type: 'session.retry.scheduled',
  durable: durable(1),
  data: {
    sessionID: SESSION_ID,
    assistantMessageID: 'msg-1',
    attempt: 2,
    at: 5000,
    error: { type: 'api', message: 'boom' },
  },
};

const compactionStarted: SessionLogItem = {
  id: 'evt_compaction',
  created: 300,
  type: 'session.compaction.started',
  durable: durable(2),
  data: { sessionID: SESSION_ID, reason: 'auto', recent: 'recent text' },
};

const execSucceeded: SessionLogItem = {
  id: 'evt_exec_ok',
  created: 400,
  type: 'session.execution.succeeded',
  durable: durable(3),
  data: { sessionID: SESSION_ID },
};

const execInterrupted: SessionLogItem = {
  id: 'evt_exec_interrupt',
  created: 410,
  type: 'session.execution.interrupted',
  durable: durable(4),
  data: { sessionID: SESSION_ID, reason: 'user' },
};

/** El server puede no reportar el motivo: `data.reason` ausente (edge case). */
const interruptedNoReason = {
  id: 'evt_exec_interrupt_none',
  created: 420,
  type: 'session.execution.interrupted',
  durable: durable(5),
  data: { sessionID: SESSION_ID },
} as unknown as SessionLogItem;

/* ------------------------------------------------------------------ */
/* Eventos en vivo (los reduce `eventReducer` y los aplica el stream)   */
/* ------------------------------------------------------------------ */

const execFailedLive: V2Event = {
  id: 'evt_exec_fail_live',
  created: 500,
  type: 'session.execution.failed',
  durable: durable(6),
  data: {
    sessionID: SESSION_ID,
    error: { type: 'api', message: 'boom' },
  },
};

const idleLive: V2Event = {
  id: 'evt_idle_live',
  created: 600,
  type: 'session.idle',
  data: { sessionID: SESSION_ID },
};

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Aplica un evento en vivo a la caché como lo haría `EventStreamProvider`. */
const applyLive = (queryClient: QueryClient, event: V2Event) => {
  const updates = reduceEvent(event) ?? [];
  for (const update of updates) {
    if (
      update.kind === 'set' &&
      sameKey(update.queryKey, queryKeys.sessions.execution(SESSION_ID))
    ) {
      queryClient.setQueryData(update.queryKey, update.updater);
    }
  }
};

const renderSignals = (sessionId: string | null = SESSION_ID) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useExecutionSignals(sessionId), { wrapper });
  return { ...view, queryClient };
};

describe('useExecutionSignals', () => {
  beforeEach(() => {
    getSessionLog.mockReset();
  });

  it('seeds retry and compaction from the durable log', async () => {
    getSessionLog.mockResolvedValue([retryScheduled, compactionStarted]);

    const { result } = renderSignals();

    await waitFor(() =>
      expect(result.current.retry).toEqual({ attempt: 2, next: 5000 }),
    );
    expect(result.current.compaction).toBe('running');
    expect(result.current.outcome).toBeNull();
    expect(getSessionLog).toHaveBeenCalledWith(SESSION_ID);
  });

  it('records the terminal outcome and interruption reason from the log', async () => {
    getSessionLog.mockResolvedValue([execInterrupted]);

    const { result } = renderSignals();

    await waitFor(() => expect(result.current.outcome).toBe('interrupted'));
    expect(result.current.interruptReason).toBe('user');
  });

  it('reports a missing interruption reason as null ("no disponible")', async () => {
    getSessionLog.mockResolvedValue([interruptedNoReason]);

    const { result } = renderSignals();

    await waitFor(() => expect(result.current.outcome).toBe('interrupted'));
    expect(result.current.interruptReason).toBeNull();
  });

  it('clears an open retry when the log ends in a terminal outcome', async () => {
    // El log durable no emite `session.idle`: el outcome terminal cierra el
    // reintento que quedó abierto (FR-018/FR-021).
    getSessionLog.mockResolvedValue([retryScheduled, execSucceeded]);

    const { result } = renderSignals();

    await waitFor(() => expect(result.current.outcome).toBe('succeeded'));
    expect(result.current.retry).toBeNull();
  });

  it('applies live events on top of the durable seed', async () => {
    getSessionLog.mockResolvedValue([retryScheduled]);

    const { result, queryClient } = renderSignals();
    await waitFor(() =>
      expect(result.current.retry).toEqual({ attempt: 2, next: 5000 }),
    );

    act(() => applyLive(queryClient, execFailedLive));
    await waitFor(() => expect(result.current.outcome).toBe('failed'));

    act(() => applyLive(queryClient, idleLive));
    await waitFor(() => expect(result.current.retry).toBeNull());
    // `session.idle` no aporta outcome: se conserva el resultado terminal.
    expect(result.current.outcome).toBe('failed');
  });

  it('stays empty without a session id and does not read the log', () => {
    const { result } = renderSignals(null);

    expect(result.current).toEqual({
      retry: null,
      compaction: null,
      outcome: null,
      interruptReason: null,
    });
    expect(getSessionLog).not.toHaveBeenCalled();
  });
});
