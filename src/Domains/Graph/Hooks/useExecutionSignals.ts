import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import type { TExecutionSignal } from '../Graph.entity';
import { deriveExecutionSignals } from '../lib/deriveExecutionSignals';
import {
  EMPTY_EXECUTION_SIGNAL,
  mergeExecutionSignals,
  normalizeSignal,
} from '../lib/executionSignal';

// La constante y el derivador viven en `lib/` (DC-24/SH-08); se reexportan para
// no romper consumidores del barrel (`Graph/index.ts`).
export { EMPTY_EXECUTION_SIGNAL, deriveExecutionSignals };

/**
 * Señales de ejecución de una sesión (FR-018/FR-019). Siembra la caché
 * `queryKeys.sessions.execution(id)` desde el log durable (`follow: false`) y la
 * deja lista para que `eventReducer` la parchee con los eventos en vivo; el
 * resultado es la señal combinada. Sin sesión devuelve la señal vacía.
 */
export const useExecutionSignals = (
  sessionId: string | null,
): TExecutionSignal => {
  const queryClient = useQueryClient();

  const logQuery = useQuery({
    queryKey: queryKeys.sessions.log(sessionId ?? ''),
    queryFn: () => opencodeService.getSessionLog(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  const seed = useMemo(
    () =>
      sessionId && logQuery.data
        ? deriveExecutionSignals(logQuery.data, sessionId)
        : null,
    [sessionId, logQuery.data],
  );

  // Escribe la siembra en la caché en vivo una sola vez por sesión, para que
  // los parches posteriores de `eventReducer` la preserven (su `updater` parte
  // del valor cacheado). Si un evento en vivo llegó antes, se combina.
  useEffect(() => {
    if (!sessionId || !seed) return;
    queryClient.setQueryData<Record<string, TExecutionSignal>>(
      queryKeys.sessions.execution(sessionId),
      (prev) => ({
        ...(prev ?? {}),
        [sessionId]: mergeExecutionSignals(seed, prev?.[sessionId]),
      }),
    );
  }, [queryClient, sessionId, seed]);

  // Lector reactivo de la caché en vivo, igual que `useGetSessionStatus`: el
  // `queryFn` no se ejecuta (hay `initialData` y `staleTime: Infinity`) y
  // devuelve lo cacheado si por algún motivo se disparara.
  const liveQuery = useQuery({
    queryKey: queryKeys.sessions.execution(sessionId ?? ''),
    queryFn: () =>
      Promise.resolve(
        queryClient.getQueryData<Record<string, TExecutionSignal>>(
          queryKeys.sessions.execution(sessionId ?? ''),
        ) ?? {},
      ),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
    initialData: {},
  });

  return useMemo(() => {
    if (!sessionId) return EMPTY_EXECUTION_SIGNAL;
    return normalizeSignal(
      liveQuery.data?.[sessionId] ?? seed ?? EMPTY_EXECUTION_SIGNAL,
    );
  }, [sessionId, liveQuery.data, seed]);
};
