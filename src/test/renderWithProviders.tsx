import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

interface TestQueryClientOptions {
  /** `0` por defecto; usa `Infinity` si el spec revalida contra caché sembrada. */
  gcTime?: number;
}

export const createTestQueryClient = ({
  gcTime = 0,
}: TestQueryClientOptions = {}) =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime, staleTime: 0 },
      mutations: { retry: 0 },
    },
  });

interface RenderOptions {
  initialEntries?: string[];
  /** Cliente propio (p. ej. con `gcTime: Infinity`); por defecto `createTestQueryClient()`. */
  queryClient?: QueryClient;
  /**
   * Siembra la caché ANTES de renderizar. Sembrar después no notifica a los
   * observadores ya montados (p. ej. el store de `useDevice`).
   */
  seed?: (queryClient: QueryClient) => void;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    seed,
  }: RenderOptions = {},
): RenderResult & { queryClient: QueryClient } => {
  seed?.(queryClient);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return Object.assign(render(ui, { wrapper: Wrapper }), { queryClient });
};
