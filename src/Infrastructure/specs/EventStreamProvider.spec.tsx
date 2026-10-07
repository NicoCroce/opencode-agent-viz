import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventStreamProvider } from '../EventStreamProvider';
import { ConnectionBadge } from '@app/Domains/Connection';
import { queryKeys } from '@app/Domains/queryKeys';
import { opencodeService } from '../Services/opencodeClient';

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    getActiveSessions: vi.fn(() => Promise.resolve({})),
    subscribeEvents: vi.fn((signal?: AbortSignal) =>
      (async function* () {
        yield { id: 'evt_connected', type: 'server.connected', data: {} };
        yield {
          id: 'evt_1',
          created: 1,
          type: 'permission.asked',
          data: {
            id: 'perm_1',
            sessionID: 'ses_1',
            action: 'bash',
            resources: ['echo hi'],
          },
        };
        // Mantiene el stream abierto hasta que el provider aborte (cleanup).
        await new Promise<void>((resolve) => {
          if (signal?.aborted) return resolve();
          signal?.addEventListener('abort', () => resolve(), { once: true });
        });
      })(),
    ),
  },
}));

const queryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EventStreamProvider', () => {
  beforeEach(() => {
    vi.mocked(opencodeService.getActiveSessions).mockResolvedValue({});
  });

  it('applies streamed events into the query cache', async () => {
    const client = queryClient();
    render(
      <QueryClientProvider client={client}>
        <EventStreamProvider>
          <div />
        </EventStreamProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const data = client.getQueryData<{ id: string }[]>(
        queryKeys.permissions.list(),
      );
      expect(data?.[0]?.id).toBe('perm_1');
    });
  });

  it('reports connected despite the StrictMode double-mount', async () => {
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient()}>
          <EventStreamProvider>
            <ConnectionBadge />
          </EventStreamProvider>
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByText('Conectado')).toBeInTheDocument(),
    );
  });

  it('seeds the active sessions into the status cache on connect', async () => {
    vi.mocked(opencodeService.getActiveSessions).mockResolvedValue({
      ses_1: { type: 'busy' as const },
    });
    const client = queryClient();

    render(
      <QueryClientProvider client={client}>
        <EventStreamProvider>
          <div />
        </EventStreamProvider>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(client.getQueryData(queryKeys.sessions.status())).toMatchObject({
        ses_1: { type: 'busy' },
      }),
    );
  });
});
