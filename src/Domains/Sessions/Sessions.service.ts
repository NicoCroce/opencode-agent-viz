import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionStatus } from '@opencode/client';
import type { TActivityMap } from '@app/Domains/Graph/Graph.entity';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';

export const useGetSessions = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.sessions.list(directory ?? ''),
    queryFn: () => opencodeService.listSessions(directory as string),
    enabled: Boolean(directory),
    staleTime: Infinity,
  });

/**
 * Lee el mapa global de estados (sessionID -> SessionStatus). El mapa lo
 * siembra `EventStreamProvider` para todos los proyectos y lo mantienen
 * actualizado los eventos SSE; este hook es solo un lector reactivo.
 *
 * El `queryFn` devuelve el valor cacheado (no `{}`): la clave de status cuelga
 * de `queryKeys.sessions.all`, así que cualquier invalidación de esa lista
 * (session.created, renamed, usage.updated, …) dispara un refetch. Devolver `{}`
 * borraba el mapa y con él los estados `busy` en vivo; reescribir el mismo dato
 * mantiene la foto intacta.
 */
export const useGetSessionStatus = () => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.sessions.status(),
    queryFn: () =>
      Promise.resolve(
        queryClient.getQueryData<Record<string, SessionStatus>>(
          queryKeys.sessions.status(),
        ) ?? {},
      ),
    staleTime: Infinity,
    initialData: {},
  });
};

/**
 * Lee el mapa global de última actividad (sessionID -> timestamp ms,
 * `TActivityMap`). Espejo de `useGetSessionStatus()`: el mapa lo parchea
 * `EventStreamProvider` con `reduceActivity` a partir de los eventos SSE
 * (mismo batching, sin red adicional); este hook es solo un lector reactivo.
 *
 * El `queryFn` devuelve el valor cacheado (no `{}`): la clave cuelga de
 * `queryKeys.sessions.all`, así que cualquier invalidación de esa lista
 * (session.created, renamed, …) dispara un refetch y devolver `{}` borraría
 * las marcas de actividad en vivo.
 */
export const useGetSessionActivity = () => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.sessions.activity(),
    queryFn: () =>
      Promise.resolve(
        queryClient.getQueryData<TActivityMap>(
          queryKeys.sessions.activity(),
        ) ?? {},
      ),
    staleTime: Infinity,
    initialData: {},
  });
};

export const useGetAgents = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.agents.list(directory ?? ''),
    queryFn: () => opencodeService.listAgents(directory as string),
    enabled: Boolean(directory),
    staleTime: Infinity,
  });
