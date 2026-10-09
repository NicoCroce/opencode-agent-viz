import { useQuery } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';

/**
 * V2 no expone todos de sesión: las tareas del subagente se derivan de los
 * tool calls del contexto (`deriveTasks`), sin request extra.
 */
export const useGetMcpServers = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.mcp.servers(directory ?? ''),
    queryFn: () => opencodeService.getMcpServers(directory ?? undefined),
    enabled: Boolean(directory),
    staleTime: Infinity,
  });

/**
 * Las instrucciones en V2 son entries por sesión
 * (`session.instructions.entry.list`), no una lista global en el config.
 */
export const useGetInstructions = (sessionId: string | null) =>
  useQuery({
    queryKey: queryKeys.sessions.instructions(sessionId ?? 'none'),
    queryFn: () =>
      opencodeService.getSessionInstructions(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });
