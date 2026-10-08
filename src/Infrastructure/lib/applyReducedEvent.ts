import type { QueryClient } from '@tanstack/react-query';
import {
  reduceEvent,
  type TReducibleEvent,
} from '@app/Domains/Graph/lib/eventReducer';

/**
 * Reduce un evento y despacha sus updates al `queryClient` (`setQueryData` o
 * `invalidateQueries`). Los eventos sin cache afectada no hacen nada.
 */
export const applyReducedEvent = (
  event: TReducibleEvent,
  queryClient: QueryClient,
): void => {
  const updates = reduceEvent(event);
  if (!updates) return;
  for (const update of updates) {
    if (update.kind === 'invalidate') {
      void queryClient.invalidateQueries({ queryKey: update.queryKey });
    } else {
      queryClient.setQueryData(update.queryKey, update.updater);
    }
  }
};
