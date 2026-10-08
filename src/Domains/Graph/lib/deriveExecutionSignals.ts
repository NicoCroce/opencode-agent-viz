import type { SessionLogItem } from '@opencode/client';
import { sameQueryKey } from '@app/Application/Helpers/queryKey';
import { queryKeys } from '../../queryKeys';
import type { TExecutionSignal } from '../Graph.entity';
import { reduceEvent, type TReducibleEvent } from './eventReducer';
import { EMPTY_EXECUTION_SIGNAL, normalizeSignal } from './executionSignal';

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
        if (update.kind !== 'set' || !sameQueryKey(update.queryKey, key)) continue;
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
