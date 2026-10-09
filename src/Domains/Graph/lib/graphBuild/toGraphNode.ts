import type {
  AgentInfo,
  FormDetail,
  PermissionRequest,
  SessionInfo,
  SessionStatus,
} from '@opencode/client';
import type {
  TActivityMap,
  TEnrichmentState,
  TExecutionSignal,
  TGraphNode,
} from '../../Graph.entity';
import {
  deriveMetricBase,
  resolveMetrics,
  type TSessionMessageLike,
} from '../deriveMetrics';
import { toNodeStatus } from '../nodeStatus';
import { hasPendingForm } from './hasPendingForm';

/** Señales por sesión que `buildGraph` entrega a cada nodo, además de `SessionInfo`. */
export interface TGraphNodeContext {
  statuses: Record<string, SessionStatus>;
  agents: AgentInfo[];
  messages: Record<string, TSessionMessageLike[]>;
  permissions: PermissionRequest[];
  signals: Record<string, TExecutionSignal>;
  forms: FormDetail[];
  enrichment: TEnrichmentState;
  /**
   * Marca de última actividad observada por sesión (`queryKeys.sessions.activity()`,
   * FR-009). Amplía la fuente de `updatedAt` con el `max` acumulado en vivo
   * (contract session-activity §4). **Opcional** para preservar la paridad de los
   * consumidores previos: sin marca, `updatedAt` cae a la lista de sesiones.
   */
  activity?: TActivityMap;
  now: number;
}

/** Construye un nodo desde la sesión y el contexto, preservando la paridad original. */
export const toGraphNode = (
  session: SessionInfo,
  {
    statuses,
    agents,
    messages,
    permissions,
    signals,
    forms,
    enrichment,
    activity,
    now,
  }: TGraphNodeContext,
): TGraphNode => {
  const sessionMessages = messages[session.id];
  const permission = permissions.some((p) => p.sessionID === session.id);
  const sessionStatus = statuses[session.id];
  const signal = signals[session.id];

  // V2 expone el agente en `SessionInfo.agent`; antes habia que deducirlo del
  // primer mensaje de usuario.
  const agentName =
    session.agent ?? (session.parentID === undefined ? 'root' : 'subagent');
  const agent = agents.find((a) => a.id === agentName);

  // La base de métricas es independiente del reloj (R3) y expone además
  // `model`/`currentTool`/`lastAssistantErrored`, que antes recorrían los
  // mensajes por separado; `resolveMetrics` solo añade `durationMs`.
  const base = deriveMetricBase(sessionMessages ?? []);
  const metrics = resolveMetrics(base, sessionStatus, now, 0);

  const status = toNodeStatus({
    status: sessionStatus,
    hasActivity: (sessionMessages?.length ?? 0) > 0,
    hasPermission: permission,
    hasPendingForm: hasPendingForm(forms, session.id),
    compaction: signal?.compaction ?? null,
    outcome: signal?.outcome ?? null,
    lastAssistantErrored: base.lastAssistantErrored,
  });

  // Fin del intervalo: la lista de sesiones (`time.idle ?? time.updated`) o la
  // marca de actividad en vivo (`activity[session.id]`), la más nueva. `null`
  // cuando ambas fuentes quedan en `0` (contract session-activity §4).
  const listedUpdatedAt = session.time.idle ?? session.time.updated ?? 0;
  const activityUpdatedAt = activity?.[session.id] ?? 0;
  const updatedAt = Math.max(listedUpdatedAt, activityUpdatedAt);

  return {
    id: session.id,
    type: 'agent' as const,
    position: { x: 0, y: 0 },
    data: {
      sessionId: session.id,
      title: session.title ?? null,
      createdAt: session.time.created,
      updatedAt: updatedAt === 0 ? null : updatedAt,
      agentName,
      directory: session.location.directory,
      model: base.model ?? agent?.model ?? null,
      status,
      // `retry`/`interruptReason` solo se exponen cuando el estado los hace
      // pertinentes (FR-018/FR-019); si la señal no los trae se cae al
      // `SessionStatus` retry, que ya lleva `attempt`/`next`.
      retry:
        status === 'retrying'
          ? (signal?.retry ??
            (sessionStatus?.type === 'retry'
              ? { attempt: sessionStatus.attempt, next: sessionStatus.next }
              : null))
          : null,
      interruptReason:
        status === 'interrupted' ? (signal?.interruptReason ?? null) : null,
      metrics,
      isRoot: session.parentID === undefined,
      currentTool: base.currentTool,
      // El paralelismo es una propiedad de la vista (depende del subárbol y
      // de `now`); se completa en `useGraphModel`.
      parallel: null,
      // El esfuerzo no se inicializa aquí: se deriva de forma pura en el memo
      // final de `useGraphModel` (data-model §2.1; effort-contract §4).
      enrichment,
    },
  };
};
