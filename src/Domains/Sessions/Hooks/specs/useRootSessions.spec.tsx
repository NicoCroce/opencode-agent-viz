import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRootSessions } from '../useRootSessions';

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    listProjects: vi.fn(() =>
      Promise.resolve([
        {
          id: 'p1',
          canonical: '/repo-a',
          time: { created: 1, updated: 1, active: 1 },
          sandboxes: [],
        },
        {
          id: 'p2',
          canonical: '/repo-b',
          time: { created: 1, updated: 1, active: 1 },
          sandboxes: [],
        },
        {
          id: 'global',
          canonical: '/',
          time: { created: 1, updated: 1, active: 1 },
          sandboxes: [],
        },
      ]),
    ),
    listSessions: vi.fn((directory: string) =>
      Promise.resolve([
        {
          id: `ses_${directory}`,
          projectID: directory,
          agent: 'develop',
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: 1, updated: 2 },
          location: { directory },
          title: directory,
        },
      ]),
    ),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe('useRootSessions', () => {
  it('aggregates root sessions across all discovered projects', async () => {
    const { result } = renderHook(() => useRootSessions(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.groups.map((g) => g.directory).sort()).toEqual([
      '/repo-a',
      '/repo-b',
    ]);
    expect(result.current.isError).toBe(false);
  });
});
