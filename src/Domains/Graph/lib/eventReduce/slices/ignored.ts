import type { TReducibleEvent } from '../eventTypes';

/**
 * Deltas que el reducer descarta **explicitamente**: la UI se construye con
 * instantaneas consolidadas, nunca acumulando deltas (FR-005, Principio VII).
 * Los deltas de texto/razonamiento ya **no** se ignoran: los acumula el slice
 * `chatStream` en la clave raiz `['chatStream', id]` (FR-002/FR-016, SC-003).
 */
export const IGNORED_EVENT_TYPES: ReadonlySet<TReducibleEvent['type']> =
  new Set([
    'session.tool.input.delta',
    'session.tool.progress',
    'session.compaction.delta',
  ]);

export type TIgnoredEvent = Extract<
  TReducibleEvent,
  {
    type:
      | 'session.tool.input.delta'
      | 'session.tool.progress'
      | 'session.compaction.delta';
  }
>;

/** No produce ningun update: el delta se ignora (FR-005). */
export const reduceIgnored = (_event: TIgnoredEvent): null => null;
