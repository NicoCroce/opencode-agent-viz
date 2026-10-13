import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

/**
 * Tools que abren una sesión hija. `subagent` es el nativo de V2; `task`
 * aparece en el historial escrito por versiones anteriores.
 *
 * **Duplicada a propósito** de `Domains/Inspector/lib/deriveTasks.ts:8`
 * (research R7): importarla cruzaría dominios (Principio II). Si cambia allí,
 * cambia aquí.
 */
const SUBAGENT_TOOLS = new Set<TInvocation['toolName']>(['subagent', 'task']);

/**
 * Una invocación de subagente (data-model §4): la unidad de paralelismo del
 * padre. La emite cada tool part `subagent`/`task` de un mensaje assistant; el
 * `stepId` es el id de ese mensaje, de modo que una hija **reutilizada en dos
 * pasos** produce dos invocaciones (FR-007).
 */
export interface TInvocation {
  /** Sesión hija abierta por el tool (`state.metadata.sessionID`); `null` si falta. */
  sessionId: string | null;
  /** Id del mensaje assistant que contiene la tool call. */
  stepId: string;
  /** `part.time.created`. */
  startedAt: number;
  /** `part.time.completed`; con `background`, `max(completed, fin hija)` (FR-016). */
  endedAt: number | null;
  /** `part.state.status`. */
  status: string;
  toolName: 'subagent' | 'task';
}

/**
 * Lote de invocaciones de un mismo paso del padre (data-model §5). `sessionIds`
 * con 2+ miembros es un lote paralelo; se conserva también el de un solo
 * miembro para que las filas puedan contar el paso completo.
 */
export interface TInvocationBatch {
  /** Paso del padre que originó el lote. */
  stepId: string;
  /** Sesión padre; `null` cuando no se conoce (el consumidor la resuelve del modelo). */
  parentId: string | null;
  /** Sesiones hijas invocadas en el paso, sin repeticiones. */
  sessionIds: string[];
}

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * El input del tool llega como texto plano mientras se transmite y como objeto
 * una vez ejecutado; normalizamos ambos casos (mismo criterio que
 * `Inspector/lib/deriveTasks.ts`).
 */
const toolInput = (state: { status: string; input: unknown }): Record<string, unknown> =>
  state.status === 'streaming' ? {} : asObject(state.input);

/** `metadata.sessionID` es el vínculo con la sesión hija que abrió el subagente. */
const toolMetadata = (state: { status: string; metadata?: unknown }): Record<string, unknown> =>
  state.status === 'streaming' ? {} : asObject(state.metadata);

/**
 * Fin de la invocación (FR-016, research R9): el del tool part del padre, y solo
 * con `input.background === true` el `max` con el fin conocido de la sesión hija
 * (0 casos medidos: la hija no puede acortar la invocación del padre).
 */
const invocationEnd = (
  endOfToolPart: number | null,
  isBackground: boolean,
  sessionId: string | null,
  childEndedAtBySessionId: Record<string, number>,
): number | null => {
  if (!isBackground || sessionId === null) return endOfToolPart;

  const childEndedAt = childEndedAtBySessionId[sessionId];
  if (typeof childEndedAt !== 'number') return endOfToolPart;
  if (endOfToolPart === null) return childEndedAt;

  return Math.max(endOfToolPart, childEndedAt);
};

/**
 * Deriva las invocaciones del padre desde los mensajes de su sesión (contrato
 * `invocation-lanes` §1). Función pura, sin React (Principio V) y sin consultas
 * nuevas: los mensajes ya están en `queryKeys.sessions.messages(id)`.
 *
 * `childEndedAtBySessionId` solo alimenta el caso `background`: el fin observado
 * de cada sesión hija, que puede sobrevivir al tool part que la lanzó.
 */
export const deriveInvocations = (
  messages: TSessionMessage[],
  childEndedAtBySessionId: Record<string, number> = {},
): TInvocation[] => {
  const invocations: TInvocation[] = [];

  for (const { info, parts } of messages) {
    if (info.type !== 'assistant') continue;

    for (const part of parts) {
      if (part.type !== 'tool') continue;
      if (!SUBAGENT_TOOLS.has(part.name as TInvocation['toolName'])) continue;

      const input = toolInput(part.state);
      const sessionId = asString(toolMetadata(part.state).sessionID);

      invocations.push({
        sessionId,
        stepId: info.id,
        startedAt: part.time.created,
        endedAt: invocationEnd(
          part.time.completed ?? null,
          input.background === true,
          sessionId,
          childEndedAtBySessionId,
        ),
        status: part.state.status,
        toolName: part.name as TInvocation['toolName'],
      });
    }
  }

  return invocations;
};

/**
 * Agrupa las invocaciones por `stepId` del padre (contrato §2): todas las
 * invocaciones de un mismo paso forman **un** lote, y pasos distintos nunca se
 * fusionan. Conserva el orden de primera aparición del paso; las invocaciones
 * sin `sessionId` no pueden representarse en un lote y se omiten.
 */
export const deriveInvocationBatches = (
  invocations: TInvocation[],
  parentId: string | null = null,
): TInvocationBatch[] => {
  const sessionIdsByStep = new Map<string, string[]>();

  for (const invocation of invocations) {
    const { sessionId, stepId } = invocation;
    if (sessionId === null) continue;

    const sessionIds = sessionIdsByStep.get(stepId);
    if (!sessionIds) {
      sessionIdsByStep.set(stepId, [sessionId]);
      continue;
    }
    if (!sessionIds.includes(sessionId)) sessionIds.push(sessionId);
  }

  return [...sessionIdsByStep].map(([stepId, sessionIds]) => ({
    stepId,
    parentId,
    sessionIds,
  }));
};
