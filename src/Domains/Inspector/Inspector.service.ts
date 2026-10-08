import { useQuery } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';
import type {
  TSessionContextResult,
  TSessionDiffResult,
  TSessionFormsResult,
  TSessionInboxResult,
  TSessionPermissionsResult,
} from './Inspector.entity';
import { toPermissionEntry, toQuestionEntry } from './lib/questionMappers';

// Recursos (MCP/instrucciones) en su propio service; re-exportados para
// preservar la API pública que consumen `useInspectorData` y el barrel.
export {
  useGetInstructions,
  useGetMcpServers,
} from './InspectorResources.service';

// Mensajes de la sesión en su propio service; re-exportados para preservar la
// API pública que consumen `useInspectorData` y el barrel.
export {
  useSessionMessages,
  type TSessionMessagesResult,
} from './InspectorMessages.service';

/**
 * Impacto del agente en el repositorio (FR-028..FR-030): archivos afectados y
 * sus parches. Read-only; expone `isError`/`isLoading` para que la sección
 * `FileChanges` renderice error → loading → vacío → datos (Principio VI).
 */
export const useSessionDiff = (
  sessionId: string | null,
): TSessionDiffResult => {
  const query = useQuery({
    queryKey: queryKeys.sessions.diff(sessionId ?? 'none'),
    queryFn: () => opencodeService.getSessionDiff(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  return {
    changes: query.data ?? [],
    isError: query.isError,
    isLoading: query.isLoading,
  };
};

/**
 * Preguntas dirigidas al usuario (FR-032/FR-033): lista los formularios de la
 * sesión y resuelve el estado de cada uno con `getSessionForm`, de modo que
 * `pending`/`cancelled` nunca se presenten como `answered`. Expone
 * `isError`/`isLoading` para el render error → loading → vacío → datos.
 */
export const useSessionForms = (
  sessionId: string | null,
): TSessionFormsResult => {
  const query = useQuery({
    // Clave propia de las preguntas resueltas: NO comparte caché con los
    // `FormInfo[]` crudos que el grafo guarda en `sessions.forms(id)` (formas
    // incompatibles; con `staleTime: Infinity` ganaba quien cargase primero).
    queryKey: queryKeys.sessions.questions(sessionId ?? 'none'),
    queryFn: async () => {
      const forms = await opencodeService.listSessionForms(sessionId as string);
      const details = await Promise.all(
        forms.map((form) =>
          opencodeService.getSessionForm(sessionId as string, form.id),
        ),
      );
      return details.map(toQuestionEntry);
    },
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  return {
    questions: query.data ?? [],
    isError: query.isError,
    isLoading: query.isLoading,
  };
};

/**
 * Permisos que la sesión está esperando (FR-031): `action` (operación) y
 * `resources[]` (recursos afectados). Read-only; expone `isError`/`isLoading`.
 */
export const useSessionPermissions = (
  sessionId: string | null,
): TSessionPermissionsResult => {
  const query = useQuery({
    queryKey: queryKeys.permissions.for(sessionId ?? 'none'),
    queryFn: () => opencodeService.getSessionPermissions(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  return {
    permissions: (query.data ?? []).map(toPermissionEntry),
    isError: query.isError,
    isLoading: query.isLoading,
  };
};

/**
 * Cola de turnos de la sesión (FR-034): `queuedTurns` cuenta los items con
 * `delivery === 'queue'`. Read-only; expone `isError`/`isLoading`.
 */
export const useSessionInbox = (
  sessionId: string | null,
): TSessionInboxResult => {
  const query = useQuery({
    queryKey: queryKeys.sessions.inbox(sessionId ?? 'none'),
    queryFn: () => opencodeService.listSessionInbox(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  const items = query.data ?? [];

  return {
    queuedTurns: items.filter((item) => item.delivery === 'queue').length,
    items,
    isError: query.isError,
    isLoading: query.isLoading,
  };
};

/**
 * Contexto resultante de una compactación (FR-035): `session.context`, cargado
 * bajo demanda. Read-only; expone `isError`/`isLoading` para que la sección
 * `CompactionContext` renderice error → loading → vacío → datos (Principio VI).
 */
export const useSessionContext = (
  sessionId: string | null,
): TSessionContextResult => {
  const query = useQuery({
    queryKey: queryKeys.sessions.context(sessionId ?? 'none'),
    queryFn: () => opencodeService.getSessionContext(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  return {
    messages: query.data ?? [],
    isError: query.isError,
    isLoading: query.isLoading,
  };
};
