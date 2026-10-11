import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  AgentInfo,
  FormInfo,
  PermissionRequest,
  SessionInterruptResponse,
  SessionStatus,
} from '@opencode/client';
import { toast } from 'sonner';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { catalogReadService } from '@app/Infrastructure/Services/catalog.service';
import { sessionWriteService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';
import {
  TChatWriteError,
  type TAgentOption,
  type TChatSelection,
} from './Chat.entity';
import { mapModelOptions } from './lib/mapModelOptions';

/**
 * Servicio del dominio Chat: mutations de escritura y lectores reactivos de la
 * caché que alimentan el panel (contrato `write-facade` §1, §3; data-model §3).
 *
 * La escritura pasa por el singleton hermano `sessionWriteService` (nunca por
 * `opencodeService`, FR-016) y la validación Zod vive en la fachada (FR-019);
 * aquí solo se decide el modo de entrega (`steer`/`queue`) y se refresca el
 * timeline. Los componentes nunca tocan el SDK (Principio III).
 */

/**
 * ¿La sesión está ocupada? `busy` deriva de `SessionStatus` reducido por eventos
 * (data-model §1, §4.1) y decide la entrega del prompt: con la sesión ocupada se
 * encola sin cortar el turno (FR-020).
 */
export const isSessionBusy = (status?: SessionStatus): boolean =>
  status?.type === 'busy';

/**
 * Lector **reactivo** de una clave de la caché de TanStack Query.
 *
 * No registra una query (a diferencia de `useQuery`): solo se suscribe a la
 * `QueryCache` y devuelve el dato cacheado, de modo que los `setQueryData` del
 * reducer de eventos (deltas → `chatStream`, mensajes → `sessions.messages`)
 * re-renderizan al consumidor sin compartir un `queryFn` con otros dominios.
 */
export const useCachedQueryData = <T,>(key: readonly unknown[]): T | undefined => {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(key);

  // El valor inicial se lee en el primer render; el efecto re-sincroniza al
  // cambiar de clave y en cada `setQueryData` que toque esa misma clave.
  const [value, setValue] = useState<T | undefined>(() =>
    queryClient.getQueryData<T>(key),
  );

  useEffect(() => {
    const parsedKey = JSON.parse(serialized) as readonly unknown[];
    const read = () => setValue(queryClient.getQueryData<T>(parsedKey));
    read();

    return queryClient.getQueryCache().subscribe((event) => {
      if (JSON.stringify(event.query.queryKey) === serialized) read();
    });
  }, [queryClient, serialized]);

  return value;
};

/** Resultado del envío: si el prompt fue a la cola (`delivery: 'queue'`). */
export interface TSendPromptResult {
  queued: boolean;
}

/**
 * `useSendPrompt(sessionId)` — mutation de envío de un prompt a la sesión.
 *
 * Decide `queue` leyendo el mapa global de estados **en el momento del envío**:
 * con la sesión `busy` el prompt va a la cola (`delivery: 'queue'`, FR-020); si
 * no, se envía sin `delivery` (steer por defecto del SDK). Tras el éxito
 * invalida el timeline (`sessions.messages(id)`) para reflejar el mensaje propio
 * (FR-001); un fallo se propaga como `TChatWriteError` para que la UI conserve
 * el texto y avise (FR-022).
 */
export const useSendPrompt = (sessionId: string) => {
  const queryClient = useQueryClient();

  return useMutation<TSendPromptResult, Error, string>({
    mutationFn: async (text: string) => {
      const statuses =
        queryClient.getQueryData<Record<string, SessionStatus>>(
          queryKeys.sessions.status(),
        ) ?? {};
      const queue = isSessionBusy(statuses[sessionId]);

      const inbox = await sessionWriteService.sendPrompt({
        sessionID: sessionId,
        text,
        queue,
      });

      return { queued: inbox.delivery === 'queue' };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.messages(sessionId),
      });
    },
  });
};

/**
 * `useInterruptSession(sessionId)` — mutation que **detiene el turno** de la
 * sesión abierta (FR-004).
 *
 * Llama a `sessionWriteService.interruptSession` con el `sessionID` de la sesión
 * abierta: la interrupción es **por sesión**, así que las sesiones hijas
 * (subagentes) siguen su curso (FR-004). El control solo está disponible con la
 * sesión `busy`; la mutation lo comprueba en el momento de invocarse y no toca
 * la red si la sesión ya no está en curso (evita un corte accidental en una
 * carrera). El estado de carga se lee de `isPending` (data-model §1). Un fallo se
 * expone como `TChatWriteError` para que la UI avise (FR-022).
 */
export const useInterruptSession = (sessionId: string) => {
  const queryClient = useQueryClient();

  return useMutation<SessionInterruptResponse, TChatWriteError, void>({
    mutationFn: async () => {
      const statuses =
        queryClient.getQueryData<Record<string, SessionStatus>>(
          queryKeys.sessions.status(),
        ) ?? {};

      if (!isSessionBusy(statuses[sessionId])) {
        throw new TChatWriteError(
          'validation',
          'La sesión ya no está en curso',
        );
      }

      return sessionWriteService.interruptSession(sessionId);
    },
  });
};

/** Variables de `useReplyPermission`: el `sessionID` es el de **origen**. */
export interface TReplyPermissionVars {
  /** Sesión que generó el pendiente (puede ser una hija/subagente, FR-007). */
  sessionID: string;
  /** `PermissionRequest.id` del pendiente; nunca texto libre (FR-019). */
  requestID: string;
  /** Decisión explícita del permiso (FR-005). */
  decision: 'once' | 'always' | 'reject';
  /** Motivo opcional (p. ej. al rechazar). */
  message?: string;
}

/** Variables de `useReplyForm`: el `sessionID` es el de **origen**. */
export interface TReplyFormVars {
  /** Sesión que generó el pendiente (puede ser una hija/subagente, FR-007). */
  sessionID: string;
  /** `FormInfo.id` del pendiente; nunca texto libre (FR-019). */
  formID: string;
  /** Valores por `field.key` del formulario (FR-005). */
  answer: Record<string, string | number | boolean | string[]>;
}

/**
 * ¿El permiso sigue **abierto**? Se comprueba en la caché global reducida
 * (`permissions.list()`), que incluye los permisos de sesiones hijas porque el
 * evento `permission.asked` trae su `sessionID` (FR-006/FR-007).
 */
const isPermissionOpen = (
  queryClient: QueryClient,
  sessionID: string,
  requestID: string,
): boolean => {
  const permissions =
    queryClient.getQueryData<PermissionRequest[]>(queryKeys.permissions.list()) ??
    [];
  return permissions.some(
    (permission) =>
      permission.id === requestID && permission.sessionID === sessionID,
  );
};

/**
 * ¿La pregunta sigue **`pending`**? Se lee de las preguntas resueltas
 * (`sessions.questions`, con `state`) y, si aún no cargaron, se cae a la lista
 * cruda de formularios (`sessions.forms`) como comprobación de existencia
 * (FR-006).
 */
const isFormOpen = (
  queryClient: QueryClient,
  sessionID: string,
  formID: string,
): boolean => {
  const questions = queryClient.getQueryData<TQuestionEntry[]>(
    queryKeys.sessions.questions(sessionID),
  );
  const known = questions?.find((question) => question.id === formID);
  if (known) return known.state === 'pending';

  const forms =
    queryClient.getQueryData<FormInfo[]>(queryKeys.sessions.forms(sessionID)) ??
    [];
  return forms.some((form) => form.id === formID);
};

/**
 * Limpia el pendiente y sus señales tras responder (FR-011): invalida la lista
 * global, los permisos del origen y los formularios del origen, de modo que el
 * ítem desaparece de la bandeja y de la atención.
 */
const invalidatePending = (
  queryClient: QueryClient,
  sessionID: string,
): void => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.permissions.list() });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.permissions.for(sessionID),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.sessions.forms(sessionID),
  });
};

/**
 * Aviso efímero y accesible ante un fallo de escritura (FR-022). La
 * revalidación fallida (pendiente ya resuelto) se lanza como
 * `TChatWriteError('validation')` y se avisa sin aplicar la respuesta (FR-006).
 */
const notifyWriteError = (error: TChatWriteError): void => {
  if (error.code === 'validation') {
    toast.warning(error.message);
    return;
  }
  toast.error(error.message);
};

/**
 * `useReplyPermission()` — mutation que responde un permiso con decisión
 * explícita (FR-005).
 *
 * Recibe el `sessionID` de **origen** del pendiente (hija incluida, FR-007) y
 * revalida, en el momento de invocarse, que el permiso siga abierto: si ya se
 * resolvió por otra vía (TUI/otra pestaña) lanza `TChatWriteError` y **no**
 * toca la red (FR-006). Tras el éxito invalida `permissions.list()`,
 * `permissions.for(originId)` y `sessions.forms(originId)` para limpiar las
 * señales (FR-011); un fallo se avisa como `TChatWriteError` (FR-022).
 */
export const useReplyPermission = () => {
  const queryClient = useQueryClient();

  return useMutation<void, TChatWriteError, TReplyPermissionVars>({
    mutationFn: async ({ sessionID, requestID, decision, message }) => {
      if (!isPermissionOpen(queryClient, sessionID, requestID)) {
        throw new TChatWriteError(
          'validation',
          'El permiso ya no está abierto',
        );
      }

      return sessionWriteService.replyPermission({
        sessionID,
        requestID,
        decision,
        ...(message !== undefined ? { message } : {}),
      });
    },
    onSuccess: (_data, { sessionID }) =>
      invalidatePending(queryClient, sessionID),
    onError: (error) => notifyWriteError(error),
  });
};

/**
 * `useReplyForm()` — mutation que responde una pregunta según sus opciones
 * (FR-005).
 *
 * Recibe el `sessionID` de **origen** del pendiente (hija incluida, FR-007) y
 * revalida que la pregunta siga `pending` antes de enviar; si ya se resolvió,
 * lanza `TChatWriteError` y no aplica la respuesta (FR-006). Tras el éxito
 * invalida las mismas claves que `useReplyPermission` (FR-011) y avisa los
 * fallos como `TChatWriteError` (FR-022).
 */
export const useReplyForm = () => {
  const queryClient = useQueryClient();

  return useMutation<void, TChatWriteError, TReplyFormVars>({
    mutationFn: async ({ sessionID, formID, answer }) => {
      if (!isFormOpen(queryClient, sessionID, formID)) {
        throw new TChatWriteError(
          'validation',
          'La pregunta ya no está abierta',
        );
      }

      return sessionWriteService.replyForm({ sessionID, formID, answer });
    },
    onSuccess: (_data, { sessionID }) =>
      invalidatePending(queryClient, sessionID),
    onError: (error) => notifyWriteError(error),
  });
};

/**
 * `useModelOptions(directory)` — catálogo de modelos para el selector
 * (FR-008).
 *
 * Envuelve `catalogReadService.listModels` (SDK `model.list`, scopeado por
 * `directory` como el resto del catálogo) y proyecta `ModelInfo[]` →
 * `TModelOption[]` con la función pura `mapModelOptions` (variantes de
 * razonamiento derivadas de `ModelInfo.variants`). Se usa `select` para que la
 * caché conserve los `ModelInfo[]` crudos de la clave `models.list` y la
 * proyección no acople el tipo de caché al de la vista. La query queda
 * deshabilitada sin `directory` (Principio III: el SDK solo se toca aquí).
 */
export const useModelOptions = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.models.list(directory ?? ''),
    queryFn: () => catalogReadService.listModels(directory as string),
    enabled: Boolean(directory),
    staleTime: Infinity,
    select: mapModelOptions,
  });

/**
 * `useAgentOptions(directory)` — catálogo de agentes para el selector
 * (FR-008).
 *
 * Comparte la clave `agents.list(directory)` con `useGetAgents` (Sessions) y
 * conserva en caché los `AgentInfo[]` crudos; `select` los proyecta a
 * `TAgentOption[]` (`{ id, label }`), de modo que la forma de caché no entra en
 * conflicto con otros consumidores del catálogo de agentes.
 */
export const useAgentOptions = (directory: string | null) =>
  useQuery({
    queryKey: queryKeys.agents.list(directory ?? ''),
    queryFn: () => catalogReadService.listAgents(directory as string),
    enabled: Boolean(directory),
    staleTime: Infinity,
    select: (agents: AgentInfo[]): TAgentOption[] =>
      agents.map((agent) => ({ id: agent.id, label: agent.name })),
  });

/**
 * `useSetSelection(sessionId)` — mutation que aplica la selección de
 * agente/modelo **antes** del envío (FR-008, W7).
 *
 * Recibe la `TChatSelection` vigente y solo toca la red para los campos que
 * difieren (`null` = no cambiar): `switchAgent` si cambió el agente y
 * `switchModel` si cambió el modelo o su variante. La decisión de "solo si
 * cambió" la toma `useChatController` al sembrar la selección desde el nodo
 * abierto; esta mutation se limita a mapear 1:1 a `sessionWriteService` y
 * propaga sus `TChatWriteError` (FR-022). El orden `switch* → prompt` lo
 * garantiza el consumidor al encadenar esta mutation antes de `useSendPrompt`.
 */
export const useSetSelection = (sessionId: string) =>
  useMutation<void, TChatWriteError, TChatSelection>({
    mutationFn: async (selection) => {
      if (selection.agent !== null) {
        await sessionWriteService.switchAgent(sessionId, selection.agent);
      }
      if (selection.model !== null) {
        await sessionWriteService.switchModel(sessionId, selection.model);
      }
    },
  });
