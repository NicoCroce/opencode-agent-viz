import type { QueryClient } from '@tanstack/react-query';
import {
  reduceActivity,
  reduceEvent,
  type TReducibleEvent,
  type TQueryUpdate,
} from '@app/Domains/Graph/lib/eventReducer';
import { coalesceQueryUpdates } from './coalesceQueryUpdates';

/** Despacha un update de cache al `queryClient` sin disparar red. */
const applyUpdate = (update: TQueryUpdate, queryClient: QueryClient): void => {
  if (update.kind === 'invalidate') {
    void queryClient.invalidateQueries({ queryKey: update.queryKey });
  } else {
    queryClient.setQueryData(update.queryKey, update.updater);
  }
};

/**
 * Reduce un evento y despacha sus updates al `queryClient` (`setQueryData` o
 * `invalidateQueries`). La marca de actividad (`sessions.activity()`) se aplica
 * **antes** de `reduceEvent` para que también los eventos que éste ignora
 * (deltas) refresquen la marca (contract session-activity §3). `reduceEvent`
 * conserva su contrato sin cambios y no se dispara red adicional: ambos usan el
 * mismo `setQueryData` dentro del batching existente. Los eventos sin cache
 * afectada no hacen nada.
 */
export const applyReducedEvent = (
  event: TReducibleEvent,
  queryClient: QueryClient,
): void => {
  // La marca de actividad puede ser el primer escritor de su cache: cuando aún
  // no hay data sembramos un mapa vacío para `prev` (equivale al `initialData`
  // que expone el hook de lectura), sin alterar el updater puro de T014.
  const activity = reduceActivity(event);
  if (activity && activity.kind === 'set') {
    const { queryKey, updater } = activity;
    queryClient.setQueryData(queryKey, (prev) => updater(prev ?? {}));
  }

  const updates = reduceEvent(event);
  if (!updates) return;
  for (const update of updates) {
    applyUpdate(update, queryClient);
  }
};

/**
 * Aplica un flush completo de eventos al `queryClient`. Por cada evento reduce
 * la marca de actividad (antes de `reduceEvent`, igual que `applyReducedEvent`)
 * y sus updates, acumula todo en un único `TQueryUpdate[]` y lo pasa por
 * `coalesceQueryUpdates` antes de despacharlo. El estado final de la caché
 * (datos e `isInvalidated`) coincide con el de aplicar los updates en orden,
 * aunque la secuencia de llamadas al `queryClient` no: un flush de decenas de
 * eventos sobre la misma `queryKey` (`sessions.activity()`, `sessions.all`)
 * dispara muchas menos.
 */
export const applyReducedEvents = (
  events: readonly TReducibleEvent[],
  queryClient: QueryClient,
): void => {
  const updates: TQueryUpdate[] = [];

  for (const event of events) {
    // La marca de actividad se envuelve con `prev ?? {}` en el momento de
    // acumular, para conservar el sembrado de `applyReducedEvent`.
    const activity = reduceActivity(event);
    if (activity && activity.kind === 'set') {
      const { queryKey, updater } = activity;
      updates.push({
        kind: 'set',
        queryKey,
        updater: (prev) => updater(prev ?? {}),
      });
    }

    const eventUpdates = reduceEvent(event);
    if (eventUpdates) updates.push(...eventUpdates);
  }

  for (const update of coalesceQueryUpdates(updates)) {
    applyUpdate(update, queryClient);
  }
};
