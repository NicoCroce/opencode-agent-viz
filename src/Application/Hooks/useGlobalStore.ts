import { useCallback } from 'react';
import { useQuery, useQueryClient, Updater } from '@tanstack/react-query';

type QueryDataUpdater<TData> = Updater<TData | undefined, TData>;

/** Claves compartidas del store global (evita magic strings). */
export const STORE_KEY = {
  isMobile: 'isMobile',
  backButtonEnabled: 'backButtonEnabled',
} as const;

/**
 * @param queryKey - The key used to save or get data from global store.
 */
export const useGlobalStore = <TData>(queryKey: string) => {
  const queryClient = useQueryClient();

  /**
   *
   * @param updater - callback for set new value.  (currentValue) => newValue
   * @returns void
   */
  const setQueryData = useCallback(
    (updater: QueryDataUpdater<TData>) =>
      queryClient.setQueryData<TData>([queryKey], updater),
    [queryClient, queryKey],
  );

  const query = useQuery<TData>({
    queryKey: [queryKey],
    queryFn: () => null as unknown as TData,
    enabled: false,
  });

  return {
    setQueryData,
    ...query,
  };
};
