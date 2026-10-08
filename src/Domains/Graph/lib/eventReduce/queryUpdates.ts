import { queryKeys } from '../../../queryKeys';

/**
 * Un evento puede (a) parchear una cache concreta o (b) invalidar una lista
 * entera. V2 dejo de emitir un `session.updated` con el `SessionInfo` completo:
 * los eventos de ciclo de vida traen solo un delta, asi que la unica forma
 * honesta de refrescar la lista es invalidarla.
 */
export type TQueryUpdate =
  | {
      readonly kind: 'set';
      readonly queryKey: readonly unknown[];
      readonly updater: (prev: unknown) => unknown;
    }
  | {
      readonly kind: 'invalidate';
      readonly queryKey: readonly unknown[];
    };

export type TEventUpdate = TQueryUpdate[];

export const set = (
  queryKey: readonly unknown[],
  updater: (prev: unknown) => unknown,
): TQueryUpdate => ({ kind: 'set', queryKey, updater });

export const invalidate = (queryKey: readonly unknown[]): TQueryUpdate => ({
  kind: 'invalidate',
  queryKey,
});

/** Invalida TODAS las listas de sesion (prefijo `['sessions']`). */
export const invalidateSessionLists = (): TQueryUpdate =>
  invalidate(queryKeys.sessions.all);

/**
 * Cotejo superficial de query keys (misma longitud e identidad elemento a
 * elemento). Se re-exporta desde el helper compartido `SH-11` para que los
 * slices y `useExecutionSignals` consuman una unica implementacion.
 */
export { sameQueryKey } from '@app/Application/Helpers/queryKey';
