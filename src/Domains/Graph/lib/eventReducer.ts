import type {
  PermissionRequest,
  SessionInfo,
  SessionMessageContentUpdated,
  SessionStatus,
  V2Event,
} from '@opencode/client';
import { queryKeys } from '../../queryKeys';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type { TExecutionSignal } from '../Graph.entity';

export type TSessionMessageCache = TSessionMessage[];

type TAssistantInfo = Extract<TSessionMessage['info'], { type: 'assistant' }>;
type TToolPart = Extract<TContentPart, { type: 'tool' }>;

/**
 * Un evento puede (a) parchear una cache concreta o (b) invalidar una lista
 * entera. V2 dejo de emitir un `session.updated` con el `SessionInfo` completo:
 * los eventos de ciclo de vida traen solo un delta, asi que la unica forma
 * honesta de refrescar la lista es invalidarla.
 */
export type TQueryUpdate =
  | {
      readonly kind: 'set';
      readonly queryKey: readonly unknown[];
      readonly updater: (prev: unknown) => unknown;
    }
  | {
      readonly kind: 'invalidate';
      readonly queryKey: readonly unknown[];
    };

export type TEventUpdate = TQueryUpdate[];

/**
 * `session.message.content.updated` es un evento **durable**: llega por el log
 * (`SessionEventDurable`) y no por el stream SSE (`V2Event`). El reducer acepta
 * ambos para poder aplicar tambien las instantaneas consolidadas del log.
 */
export type TReducibleEvent = V2Event | SessionMessageContentUpdated;

/* ------------------------------------------------------------------ */
/* Helpers de cache                                                    */
/* ------------------------------------------------------------------ */

const messagesOf = (prev: unknown): TSessionMessage[] =>
  Array.isArray(prev) ? (prev as TSessionMessage[]) : [];

const set = (
  queryKey: readonly unknown[],
  updater: (prev: unknown) => unknown,
): TQueryUpdate => ({ kind: 'set', queryKey, updater });

const invalidate = (queryKey: readonly unknown[]): TQueryUpdate => ({
  kind: 'invalidate',
  queryKey,
});

/** Invalida TODAS las listas de sesion (prefijo `['sessions']`). */
const invalidateSessionLists = (): TQueryUpdate =>
  invalidate(queryKeys.sessions.all);

const setStatus = (
  prev: unknown,
  sessionID: string,
  status: SessionStatus,
): Record<string, SessionStatus> => ({
  ...(prev !== null && typeof prev === 'object'
    ? (prev as Record<string, SessionStatus>)
    : {}),
  [sessionID]: status,
});

const removeSession = (prev: unknown, id: string): SessionInfo[] =>
  Array.isArray(prev) ? (prev as SessionInfo[]).filter((s) => s.id !== id) : [];

/**
 * `parts` es una vista de `info.content`: los dos se mantienen en sync para
 * que los consumidores (grafo, Inspector) puedan seguir iterando `parts`.
 */
const withParts = (
  message: TSessionMessage,
  parts: TContentPart[],
): TSessionMessage => ({
  ...message,
  parts,
  info:
    message.info.type === 'assistant'
      ? { ...message.info, content: parts }
      : message.info,
});

const patchMessage = (
  prev: unknown,
  messageID: string,
  patch: (message: TSessionMessage) => TSessionMessage,
): TSessionMessageCache =>
  messagesOf(prev).map((message) =>
    message.info.id === messageID ? patch(message) : message,
  );

const patchAssistantInfo = (
  prev: unknown,
  messageID: string,
  patch: Partial<TAssistantInfo>,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) =>
    message.info.type === 'assistant'
      ? { ...message, info: { ...message.info, ...patch } }
      : message,
  );

/**
 * `session.step.started` abre un mensaje assistant que aun no tiene contenido.
 * V2 no emite un "message created": lo reconstruimos con lo que el evento trae.
 */
const upsertAssistantShell = (
  prev: unknown,
  event: Extract<V2Event, { type: 'session.step.started' }>,
): TSessionMessageCache => {
  const { assistantMessageID, agent, model, started } = event.data;
  const existing = messagesOf(prev).find((m) => m.info.id === assistantMessageID);
  const info: TAssistantInfo = {
    id: assistantMessageID,
    type: 'assistant',
    time: existing?.info.type === 'assistant' ? existing.info.time : { created: started },
    agent,
    model,
    content: [],
  };
  if (existing) {
    return patchMessage(prev, assistantMessageID, () => ({ info, parts: [] }));
  }
  return [...messagesOf(prev), { info, parts: [] }];
};

/**
 * Inserta o actualiza una parte de tool a partir de su evento. La parte se
 * construye con el `existing` a la vista para heredar `name` e `input`, que los
 * eventos `tool.success`/`tool.failed` no repiten.
 */
const upsertToolPart = (
  prev: unknown,
  messageID: string,
  event: TToolEvent,
  created: number,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => {
    const existing = message.parts.find(
      (p): p is TToolPart => p.type === 'tool' && p.id === event.data.id,
    );
    const part = toolPartFrom(event, created, existing);
    const rest = message.parts.filter(
      (p) => !(p.type === 'tool' && p.id === event.data.id),
    );
    return withParts(message, [...rest, part]);
  });

/* ------------------------------------------------------------------ */
/* Contenido consolidado (text / reasoning)                            */
/* ------------------------------------------------------------------ */

const textPart = (text: string): TContentPart => ({ type: 'text', text });

const reasoningPart = (text: string): TContentPart => ({
  type: 'reasoning',
  text,
});

/**
 * Inserta/reemplaza una parte consolidada en la posicion `ordinal` del
 * contenido del assistant (R6): los eventos `*.ended` traen el texto completo
 * y su ordinal, y `content` se mantiene ordenado por el. Nunca se acumulan
 * deltas (FR-005, Principio VII).
 */
const upsertContentPart = (
  prev: unknown,
  messageID: string,
  ordinal: number,
  part: TContentPart,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => {
    const parts = [...message.parts];
    if (ordinal < parts.length) {
      parts[ordinal] = part;
    } else {
      parts.push(part);
    }
    return withParts(message, parts);
  });

/**
 * `session.message.content.updated` trae la instantanea durable completa del
 * contenido: es un reemplazo consolidado, no incremental (R6), asi que no
 * viola FR-005.
 */
const replaceContent = (
  prev: unknown,
  messageID: string,
  content: TContentPart[],
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => withParts(message, content));

/* ------------------------------------------------------------------ */
/* Senales de ejecucion                                                */
/* ------------------------------------------------------------------ */

const EMPTY_SIGNAL: TExecutionSignal = {
  retry: null,
  compaction: null,
  outcome: null,
  interruptReason: null,
};

const signalsOf = (prev: unknown): Record<string, TExecutionSignal> =>
  prev !== null && typeof prev === 'object'
    ? (prev as Record<string, TExecutionSignal>)
    : {};

const patchExecution = (
  prev: unknown,
  sessionID: string,
  patch: Partial<TExecutionSignal>,
): Record<string, TExecutionSignal> => {
  const signals = signalsOf(prev);
  const current = signals[sessionID] ?? EMPTY_SIGNAL;
  return { ...signals, [sessionID]: { ...current, ...patch } };
};

/* ------------------------------------------------------------------ */
/* Construccion de partes de tool desde eventos                         */
/* ------------------------------------------------------------------ */

type TToolEvent = Extract<
  V2Event,
  | { type: 'session.tool.input.started' }
  | { type: 'session.tool.called' }
  | { type: 'session.tool.success' }
  | { type: 'session.tool.failed' }
>;

type TToolState = Extract<TContentPart, { type: 'tool' }>['state'];
type TToolResultContent = Extract<
  TToolState,
  { status: 'completed' }
>['content'];
type TToolInput = Extract<TToolState, { status: 'running' }>['input'];

const asRecord = (value: unknown): Record<string, never> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, never>)
    : {};

const inheritedInput = (existing: TToolPart | undefined): TToolInput => {
  if (!existing) return {};
  const state = existing.state;
  return state.status === 'streaming' ? {} : state.input;
};

const toolPartFrom = (
  event: TToolEvent,
  created: number,
  existing?: TToolPart,
): TToolPart => {
  if (event.type === 'session.tool.input.started') {
    return {
      type: 'tool',
      id: event.data.id,
      name: event.data.name,
      state: { status: 'streaming', input: '' },
      time: { created },
    };
  }

  const name = existing?.name ?? event.data.id;

  if (event.type === 'session.tool.called') {
    return {
      type: 'tool',
      id: event.data.id,
      name,
      executed: event.data.executed,
      state: {
        status: 'running',
        input: asRecord(event.data.input),
        metadata: asRecord(event.data.state),
      },
      time: { created, ran: created },
    };
  }

  // `success` y `failed` no repiten `name` ni `input`: se heredan del parte ya
  // cacheado (`inheritedInput`) para no perderlos al reemplazar el estado.
  const input = inheritedInput(existing);

  if (event.type === 'session.tool.success') {
    return {
      type: 'tool',
      id: event.data.id,
      name,
      executed: event.data.executed,
      state: {
        status: 'completed',
        input,
        content: event.data.content,
        metadata: asRecord(event.data.metadata),
      },
      time: { created, completed: created },
    };
  }

  return {
    type: 'tool',
    id: event.data.id,
    name,
    executed: event.data.executed,
    state: {
      status: 'error',
      input,
      error: event.data.error,
      content: event.data.content as TToolResultContent | undefined,
      metadata: asRecord(event.data.metadata),
    },
    time: { created, completed: created },
  };
};

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

const upsertPermission = (
  prev: unknown,
  permission: PermissionRequest,
): PermissionRequest[] => {
  const permissions = Array.isArray(prev)
    ? (prev as PermissionRequest[])
    : [];
  return [...permissions.filter((p) => p.id !== permission.id), permission];
};

const removePermission = (
  prev: unknown,
  permissionID: string,
): PermissionRequest[] =>
  Array.isArray(prev)
    ? (prev as PermissionRequest[]).filter((p) => p.id !== permissionID)
    : [];

/* ------------------------------------------------------------------ */

export const reduceEvent = (event: TReducibleEvent): TEventUpdate | null => {
  switch (event.type) {
    case 'server.connected':
      return [set(queryKeys.connection.state, () => 'connected')];

    /* --- ciclo de vida: V2 solo emite deltas, no el SessionInfo completo --- */
    case 'session.created':
    case 'session.renamed':
    case 'session.metadata.updated':
    case 'session.moved':
    case 'session.usage.updated':
    case 'session.forked':
    case 'session.agent.selected':
    case 'session.model.selected':
      return [invalidateSessionLists()];

    case 'session.deleted':
      return [
        set(queryKeys.sessions.all, (prev) =>
          removeSession(prev, event.data.sessionID),
        ),
      ];

    /* --- estado --- */
    case 'session.status': {
      const { sessionID, status } = event.data;
      const updates: TEventUpdate = [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, sessionID, status),
        ),
      ];
      // `status.type === 'retry'` aporta `attempt`/`next` a las senales (R5).
      if (status.type === 'retry') {
        updates.push(
          set(queryKeys.sessions.execution(sessionID), (prev) =>
            patchExecution(prev, sessionID, {
              retry: { attempt: status.attempt, next: status.next },
            }),
          ),
        );
      }
      return updates;
    }

    case 'session.idle':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        // El evento SSE `session.idle` no aporta `outcome`; solo limpia el
        // estado activo (retry/compaction) al quedar la sesion ociosa (R5).
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            retry: null,
            compaction: null,
          }),
        ),
      ];

    case 'session.execution.started':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'busy' }),
        ),
        // Una nueva ejecución arranca: el outcome/anomalía de la corrida previa
        // ya no describe lo que pasa ahora. Sin este reset, `toNodeStatus`
        // devolvería el `succeeded` viejo (el outcome gana sobre `busy`) mientras
        // el agente vuelve a correr.
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            outcome: null,
            interruptReason: null,
            retry: null,
          }),
        ),
      ];

    case 'session.execution.succeeded':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { outcome: 'succeeded' }),
        ),
      ];

    case 'session.execution.failed':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { outcome: 'failed' }),
        ),
      ];

    case 'session.execution.interrupted':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            outcome: 'interrupted',
            interruptReason: event.data.reason,
          }),
        ),
      ];

    /* --- retry / compactacion (senales de ejecucion, FR-018/FR-019) --- */
    case 'session.retry.scheduled':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            retry: { attempt: event.data.attempt, next: event.data.at },
          }),
        ),
      ];

    case 'session.compaction.started':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { compaction: 'running' }),
        ),
      ];

    case 'session.compaction.ended':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            compaction: 'completed',
          }),
        ),
      ];

    case 'session.compaction.failed':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { compaction: 'failed' }),
        ),
      ];

    /* --- mensajes --- */
    case 'session.step.started':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertAssistantShell(prev, event),
        ),
      ];

    case 'session.step.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          patchAssistantInfo(prev, event.data.assistantMessageID, {
            time: { created: event.created, completed: event.created },
            finish: event.data.finish,
            cost: event.data.cost,
            tokens: event.data.tokens,
          }),
        ),
      ];

    case 'session.step.failed':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          patchAssistantInfo(prev, event.data.assistantMessageID, {
            error: event.data.error,
          }),
        ),
      ];

    /* --- contenido consolidado (sin deltas, FR-005/FR-006) --- */
    case 'session.text.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertContentPart(
            prev,
            event.data.assistantMessageID,
            event.data.ordinal,
            textPart(event.data.text),
          ),
        ),
      ];

    case 'session.reasoning.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertContentPart(
            prev,
            event.data.assistantMessageID,
            event.data.ordinal,
            reasoningPart(event.data.text),
          ),
        ),
      ];

    case 'session.message.content.updated':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          replaceContent(
            prev,
            event.data.messageID,
            event.data.content,
          ),
        ),
      ];

    /* --- deltas: se ignoran explicitamente (FR-005, Principio VII) --- */
    case 'session.text.delta':
    case 'session.reasoning.delta':
    case 'session.tool.input.delta':
    case 'session.tool.progress':
    case 'session.compaction.delta':
      return null;

    /* --- tools --- */
    case 'session.tool.input.started':
    case 'session.tool.called':
    case 'session.tool.success':
    case 'session.tool.failed':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertToolPart(
            prev,
            event.data.assistantMessageID,
            event,
            event.created,
          ),
        ),
      ];

    /* --- permisos --- */
    case 'permission.asked':
      return [
        set(queryKeys.permissions.list(), (prev) =>
          upsertPermission(prev, event.data),
        ),
      ];

    case 'permission.replied':
      return [
        set(queryKeys.permissions.list(), (prev) =>
          removePermission(prev, event.data.requestID),
        ),
      ];

    /* --- inbox / forms: invalidar la query de la sesion para refetch --- */
    case 'session.inbox.delivered':
    case 'session.inbox.enqueued':
    case 'session.inbox.cancelled':
    case 'session.inbox.delivery.changed':
      return [invalidate(queryKeys.sessions.inbox(event.data.sessionID))];

    case 'form.created':
      return [
        invalidate(queryKeys.sessions.forms(event.data.form.sessionID)),
      ];

    case 'form.replied':
    case 'form.cancelled':
      return [invalidate(queryKeys.sessions.forms(event.data.sessionID))];

    default:
      return null;
  }
};
