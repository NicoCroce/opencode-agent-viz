import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryQuestion } from '../../History.entity';
import { useHistoryPagination } from '../useHistoryPagination';

const { getHistoryMessages } = vi.hoisted(() => ({
  getHistoryMessages: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: { getHistoryMessages },
}));

/** Mensaje mínimo válido del SDK envuelto como lo hace `normalizeMessages`. */
const userMessage = (id: string, created: number): TSessionMessage => ({
  info: { id, time: { created }, type: 'user', text: `text-${id}` },
  parts: [],
});

/** Wrapper estable por test: el mismo QueryClient sobrevive a los rerenders. */
const renderPagination = (
  sessionId: string | null = 'ses-1',
  questions: THistoryQuestion[] = [],
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useHistoryPagination(sessionId, questions), {
    wrapper,
  });
};

describe('useHistoryPagination', () => {
  beforeEach(() => {
    getHistoryMessages.mockReset();
  });

  it('fetches the first page without a cursor and paginates with the returned cursor', async () => {
    const oldest = userMessage('m1', 100);
    const middle = userMessage('m2', 200);
    const newest = userMessage('m3', 300);
    getHistoryMessages.mockImplementation((_id: string, cursor?: string) =>
      cursor === undefined
        ? Promise.resolve({ messages: [newest, middle], nextCursor: 'cursor-1' })
        : Promise.resolve({ messages: [oldest], nextCursor: null }),
    );

    const { result } = renderPagination();

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(getHistoryMessages).toHaveBeenCalledWith('ses-1', undefined);
    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(getHistoryMessages).toHaveBeenLastCalledWith('ses-1', 'cursor-1');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('flattens the desc pages into ascending chronological entries', async () => {
    const oldest = userMessage('m1', 100);
    const middle = userMessage('m2', 200);
    const newest = userMessage('m3', 300);
    getHistoryMessages.mockImplementation((_id: string, cursor?: string) =>
      cursor === undefined
        ? Promise.resolve({ messages: [newest, middle], nextCursor: 'cursor-1' })
        : Promise.resolve({ messages: [oldest], nextCursor: null }),
    );

    const { result } = renderPagination();

    // La primera página llega `desc`; se invierte a ascendente.
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'm2:0',
      'm3:0',
    ]);

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'm1:0',
      'm2:0',
      'm3:0',
    ]);
  });

  it('flags a failed next page without discarding the loaded entries', async () => {
    const middle = userMessage('m2', 200);
    const newest = userMessage('m3', 300);
    getHistoryMessages
      .mockResolvedValueOnce({ messages: [newest, middle], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new Error('page failed'));

    const { result } = renderPagination();

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.isFetchNextPageError).toBe(false);

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    // Lo ya cargado se conserva y sigue habiendo una página pendiente.
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('does not warn when the history ends normally', async () => {
    getHistoryMessages.mockResolvedValue({
      messages: [userMessage('m1', 100)],
      nextCursor: null,
    });

    const { result } = renderPagination();

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isFetchNextPageError).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('merges the injected questions anchored to their tool call (FR-033)', async () => {
    const toolContent: Extract<
      TSessionMessage['parts'][number],
      { type: 'tool' }
    > = {
      type: 'tool',
      id: 't-q',
      name: 'question',
      state: {
        status: 'completed',
        input: { question: 'Elige' },
        content: [{ type: 'text', text: 'ok' }],
      },
      time: { created: 200, completed: 220 },
    };
    const assistant: TSessionMessage = {
      info: {
        id: 'a1',
        time: { created: 200, completed: 250 },
        type: 'assistant',
        agent: 'develop',
        model: { providerID: 'opencode', id: 'deepseek' },
        content: [toolContent],
      },
      parts: [toolContent],
    };
    getHistoryMessages.mockResolvedValue({
      messages: [assistant],
      nextCursor: null,
    });

    const { result } = renderPagination('ses-1', [
      {
        id: 'q1',
        title: 'Elige',
        fields: [],
        state: 'answered',
        answer: 'choice: a',
      },
    ]);

    // El fallback sin mensajes aparece antes de que la query resuelva; se
    // espera al ancla real del tool call.
    await waitFor(() =>
      expect(result.current.entries[0]).toMatchObject({ anchored: true }),
    );
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toMatchObject({
      kind: 'question',
      formId: 'q1',
      anchorId: 't-q',
      answer: 'choice: a',
    });
  });

  it('stays idle without a session id and reports no error', () => {
    const { result } = renderPagination(null);

    expect(result.current.entries).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
    expect(getHistoryMessages).not.toHaveBeenCalled();
  });
});
