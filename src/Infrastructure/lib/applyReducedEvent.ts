import type { QueryClient } from '@tanstack/react-query';
import {
  reduceActivity,
  reduceEvent,
  type TReducibleEvent,
  type TQueryUpdate,
} from '@app/Domains/Graph/lib/eventReducer';

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
