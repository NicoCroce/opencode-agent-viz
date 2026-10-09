import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  opencodeService,
  type TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';

export interface TSessionMessagesResult {
  messages: TSessionMessage[];
  isError: boolean;
  isLoading: boolean;
}

/**
 * Mensajes de la sesión: único punto donde `useInspectorData` toca el SDK
 * (Principio III, SDK solo en `*.service.ts`). Read-only; expone
 * `isError`/`isLoading` para el render error → loading → vacío → datos.
 */
export const useSessionMessages = (
  sessionId: string | null,
): TSessionMessagesResult => {
  const query = useQuery({
    queryKey: queryKeys.sessions.messages(sessionId ?? 'none'),
    queryFn: () => opencodeService.getSessionMessages(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  // Identidad estable del array vacío: preserva las dependencias de los memos
  // de derivación cuando la query aún no tiene datos.
  const messages = useMemo(() => query.data ?? [], [query.data]);

  return {
    messages,
    isError: query.isError,
    isLoading: query.isLoading,
  };
};
