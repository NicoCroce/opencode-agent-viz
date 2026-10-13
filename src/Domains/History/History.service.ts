import { useInfiniteQuery } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';

/**
 * Histórico completo de una sesión, paginado por cursor con `useInfiniteQuery`
 * (FR-013). La primera página llega en orden `desc` (más reciente primero) y el
 * cursor que devuelve el servidor fija la dirección, así que las páginas se
 * encadenan hacia atrás sin tope fijo.
 *
 * Solo lectura: la caché vive en `queryKeys.sessions.history(id)` y no muta la
 * del grafo (data-model.md §4).
 */
export const useHistoryMessages = (sessionId: string | null) =>
  useInfiniteQuery({
    queryKey: queryKeys.sessions.history(sessionId ?? 'none'),
    queryFn: ({ pageParam }) =>
      opencodeService.getHistoryMessages(sessionId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(sessionId),
  });
