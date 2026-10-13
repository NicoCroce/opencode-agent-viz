import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  ANOMALY_THRESHOLD_STORAGE_KEY,
  DEFAULT_ANOMALY_THRESHOLD,
} from '@app/Application/Helpers/anomalyThreshold';
import { useAnomalyThreshold } from '../useAnomalyThreshold';

let queryClient: QueryClient;

beforeEach(() => {
  localStorage.clear();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useAnomalyThreshold · FR-022', () => {
  it('usa el default sin valor guardado', () => {
    const { result } = renderHook(() => useAnomalyThreshold(), { wrapper });

    expect(result.current.threshold).toBe(DEFAULT_ANOMALY_THRESHOLD);
  });

  it('rehidrata el umbral persistido al montar', () => {
    localStorage.setItem(ANOMALY_THRESHOLD_STORAGE_KEY, '0.25');

    const { result } = renderHook(() => useAnomalyThreshold(), { wrapper });

    expect(result.current.threshold).toBe(0.25);
  });

  it('persiste y acota el umbral al cambiarlo', async () => {
    const { result } = renderHook(() => useAnomalyThreshold(), { wrapper });

    act(() => result.current.setThreshold(0.7));
    // React Query programa la notificación del store con `setTimeout(0)`.
    await waitFor(() => expect(result.current.threshold).toBe(0.7));
    expect(localStorage.getItem(ANOMALY_THRESHOLD_STORAGE_KEY)).toBe('0.7');

    act(() => result.current.setThreshold(5));
    await waitFor(() => expect(result.current.threshold).toBe(0.95));
  });

  it('comparte el umbral entre consumidores (store global)', async () => {
    const first = renderHook(() => useAnomalyThreshold(), { wrapper });
    const second = renderHook(() => useAnomalyThreshold(), { wrapper });

    act(() => first.result.current.setThreshold(0.6));

    await waitFor(() => expect(second.result.current.threshold).toBe(0.6));
  });
});
