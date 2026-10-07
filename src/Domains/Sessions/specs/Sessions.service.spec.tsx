import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SessionStatus } from '@opencode/client';
import { queryKeys } from '../../queryKeys';
import { useGetSessionStatus } from '../Sessions.service';

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {},
}));

describe('useGetSessionStatus', () => {
  it('keeps the seeded statuses when sessions.all is invalidated', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const seeded: Record<string, SessionStatus> = { ses_1: { type: 'busy' } };
    client.setQueryData(queryKeys.sessions.status(), seeded);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useGetSessionStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toMatchObject(seeded));

    // La clave de status cuelga de `['sessions']`: invalidar la lista no debe
    // borrar los estados en vivo (antes el `queryFn` devolvía `{}` y los perdía).
    await client.invalidateQueries({ queryKey: queryKeys.sessions.all });

    expect(client.getQueryData(queryKeys.sessions.status())).toMatchObject(
      seeded,
    );
  });
});
