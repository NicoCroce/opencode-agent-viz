import type { TExecutionSignal } from '../Graph.entity';

/**
 * Señal sin información: `null` en todos los campos (contrato de US3).
 *
 * Fuente única del literal que antes se repetía como `EMPTY_EXECUTION_SIGNAL`
 * (`useExecutionSignals`) y `EMPTY_SIGNAL` (`eventReducer`); así un campo nuevo
 * en `TExecutionSignal` no puede quedar desincronizado entre ambos.
 */
export const EMPTY_EXECUTION_SIGNAL: TExecutionSignal = {
  retry: null,
  compaction: null,
  outcome: null,
  interruptReason: null,
};

/** Garantiza `null` (no `undefined`) cuando el server no reporta un campo. */
export const normalizeSignal = (signal: TExecutionSignal): TExecutionSignal => ({
  retry: signal.retry ?? null,
  compaction: signal.compaction ?? null,
  outcome: signal.outcome ?? null,
  interruptReason: signal.interruptReason ?? null,
});

/**
 * Combina la siembra durable con la caché en vivo: los campos que ya reportó un
 * evento en vivo ganan sobre los reconstruidos del log; el resto se completa
 * con la siembra (la caché en vivo arranca parcial, sin `outcome`).
 */
export const mergeExecutionSignals = (
  seed: TExecutionSignal,
  live: TExecutionSignal | undefined,
): TExecutionSignal => ({
  retry: live?.retry ?? seed.retry,
  compaction: live?.compaction ?? seed.compaction,
  outcome: live?.outcome ?? seed.outcome,
  interruptReason: live?.interruptReason ?? seed.interruptReason,
});

/**
 * Compara dos señales campo a campo para evitar escrituras redundantes.
 *
 * `retry` se compara por `attempt`/`next` (normalizados a `null`) porque un
 * `retry` ausente y uno con ambos campos `null` son equivalentes a efectos del
 * estado de ejecución.
 */
export const sameExecutionSignal = (
  a: TExecutionSignal,
  b: TExecutionSignal,
): boolean =>
  (a.retry?.attempt ?? null) === (b.retry?.attempt ?? null) &&
  (a.retry?.next ?? null) === (b.retry?.next ?? null) &&
  a.compaction === b.compaction &&
  a.outcome === b.outcome &&
  a.interruptReason === b.interruptReason;
