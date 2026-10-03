import { useQuery } from '@tanstack/react-query';
import type { SessionStatus } from '@opencode/client';
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
 */
export const useGetSessionStatus = () =>
  useQuery({
    queryKey: queryKeys.sessions.status(),
    queryFn: () => Promise.resolve({} as Record<string, SessionStatus>),
    staleTime: Infinity,
    initialData: {},
  });

export const useGetAgents = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.agents.list(directory ?? ''),
    queryFn: () => opencodeService.listAgents(directory as string),
    enabled: Boolean(directory),
    staleTime: Infinity,
  });
