import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionLogItem } from '@opencode/client';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { reduceEvent, type TReducibleEvent } from '../lib/eventReducer';
import type { TExecutionSignal } from '../Graph.entity';

/** Señal sin información: `null` en todos los campos (contrato de US3). */
export const EMPTY_EXECUTION_SIGNAL: TExecutionSignal = {
  retry: null,
  compaction: null,
  outcome: null,
  interruptReason: null,
};

/**
 * Un resultado terminal cierra la ejecución: a partir de ahí no puede quedar un
 * reintento ni una compactación "en curso" (FR-018/FR-021). El reducer en vivo
 * lo resuelve con `session.idle`, que no es durable y por tanto no aparece en el
 * log; la siembra lo aplica directamente al ver el outcome.
 */
const TERMINAL_OUTCOME_TYPES: ReadonlySet<string> = new Set([
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted',
]);

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Garantiza `null` (no `undefined`) cuando el server no reporta un campo. */
const normalizeSignal = (signal: TExecutionSignal): TExecutionSignal => ({
  retry: signal.retry ?? null,
  compaction: signal.compaction ?? null,
  outcome: signal.outcome ?? null,
  interruptReason: signal.interruptReason ?? null,
});

/**
 * Reconstruye la señal de ejecución a partir del log durable (`session.log`,
 * `follow: false`) reduciendo cada evento con `reduceEvent` (puro). El log no
 * incluye `session.idle`; un outcome terminal limpia el reintento/compactación
 * que hubieran quedado abiertos (edge case del contrato de US3).
 */
export const deriveExecutionSignals = (
  log: readonly SessionLogItem[],
  sessionId: string,
): TExecutionSignal => {
  const key = queryKeys.sessions.execution(sessionId);
  let cache: Record<string, TExecutionSignal> = {};

  for (const item of log) {
    if (item.type === 'log.synced') continue;

    // `SessionEventDurable` incluye eventos que `reduceEvent` no conoce (p. ej.
    // `session.usage.recorded`): para esos el reducer devuelve `null`.
    const event = item as unknown as TReducibleEvent;
    const updates = reduceEvent(event);
    if (updates) {
      for (const update of updates) {
        if (update.kind !== 'set' || !sameKey(update.queryKey, key)) continue;
        cache = update.updater(cache) as Record<string, TExecutionSignal>;
      }
    }

    if (TERMINAL_OUTCOME_TYPES.has(event.type)) {
      const current = cache[sessionId] ?? EMPTY_EXECUTION_SIGNAL;
      cache = {
        ...cache,
        [sessionId]: {
          ...current,
          retry: null,
          compaction:
            current.compaction === 'running' ? null : current.compaction,
        },
      };
    }
  }

  return normalizeSignal(cache[sessionId] ?? EMPTY_EXECUTION_SIGNAL);
};

/**
 * Combina la siembra durable con la caché en vivo: los campos que ya reportó un
 * evento en vivo ganan sobre los reconstruidos del log; el resto se completa
 * con la siembra (la caché en vivo arranca parcial, sin `outcome`).
 */
const mergeExecutionSignals = (
  seed: TExecutionSignal,
  live: TExecutionSignal | undefined,
): TExecutionSignal => ({
  retry: live?.retry ?? seed.retry,
  compaction: live?.compaction ?? seed.compaction,
  outcome: live?.outcome ?? seed.outcome,
  interruptReason: live?.interruptReason ?? seed.interruptReason,
});

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
