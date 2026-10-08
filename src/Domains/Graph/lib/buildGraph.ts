import type {
  AgentInfo,
  FormDetail,
  PermissionRequest,
  SessionInboxInfo,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";
import type {
  TEnrichmentState,
  TExecutionSignal,
  TGraphEdge,
  TGraphModel,
  TGraphNode,
} from "../Graph.entity";
import {
  deriveMetricBase,
  resolveMetrics,
  type TSessionMessageLike,
} from "./deriveMetrics";
import { toNodeStatus } from "./nodeStatus";

export interface BuildGraphInput {
  sessions: SessionInfo[];
  statuses: Record<string, SessionStatus>;
  agents: AgentInfo[];
  messages: Record<string, TSessionMessageLike[]>;
  permissions: PermissionRequest[];
  /**
   * Señal de ejecución por sesión (`queryKeys.sessions.execution(id)`), que
   * combina la siembra durable (`session.log`) con los eventos en vivo y aporta
   * `retry`, `compaction`, `outcome` e `interruptReason` (FR-018/FR-019). Ver
   * `contracts/execution-state-contract.md`.
   */
  signals: Record<string, TExecutionSignal>;
  /**
   * Formularios con su estado resuelto (`session.form.list` +
   * `session.form.get`). Un formulario `pending` marca `waiting-input`
   * (FR-032); `answered`/`cancelled` no esperan respuesta.
   */
  forms: FormDetail[];
  /**
   * Items de inbox (`session.inbox.list`). Se acepta junto a `forms` para que
   * `useGraphModel` entregue todas las señales por nodo; la cola de turnos
   * (FR-034) se muestra en el detalle del agente, no en `TNodeStatus`.
   */
  inbox: SessionInboxInfo[];
  /**
   * Estado de carga del detalle para los nodos producidos (data-model §2.2,
   * contrato de carga §1.1/§1.2): `'pending'` en la fase estructural (métricas/
   * señales/permisos/formularios aún sin fusionar) y `'ready'` cuando el
   * enriquecimiento completó el lote del nodo. Es **opcional** con default
   * `'ready'` para preservar la firma y la paridad actual (FR-007): los
   * consumidores previos no pasan el campo y obtienen el grafo enriquecido.
   */
  enrichment?: TEnrichmentState;
  now: number;
}

/** Un formulario cuenta como pendiente solo si su estado resuelto es `pending`. */
const hasPendingForm = (forms: FormDetail[], sessionId: string): boolean =>
  forms.some(
    (form) => form.sessionID === sessionId && form.state.status === "pending",
  );

export const buildGraph = ({
  sessions,
  statuses,
  agents,
  messages,
  permissions,
  signals,
  forms,
  enrichment = "ready",
  now,
}: BuildGraphInput): TGraphModel => {
  const nodes: TGraphNode[] = sessions.map((session) => {
    const sessionMessages = messages[session.id];
    const permission = permissions.some((p) => p.sessionID === session.id);
    const sessionStatus = statuses[session.id];
    const signal = signals[session.id];

    // V2 expone el agente en `SessionInfo.agent`; antes habia que deducirlo del
    // primer mensaje de usuario.
    const agentName =
      session.agent ?? (session.parentID === undefined ? "root" : "subagent");
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

    return {
      id: session.id,
      type: "agent" as const,
      position: { x: 0, y: 0 },
      data: {
        sessionId: session.id,
        title: session.title ?? null,
        createdAt: session.time.created,
        updatedAt: session.time.idle ?? session.time.updated,
        agentName,
        directory: session.location.directory,
        model: base.model ?? agent?.model ?? null,
        status,
        // `retry`/`interruptReason` solo se exponen cuando el estado los hace
        // pertinentes (FR-018/FR-019); si la señal no los trae se cae al
        // `SessionStatus` retry, que ya lleva `attempt`/`next`.
        retry:
          status === "retrying"
            ? (signal?.retry ??
              (sessionStatus?.type === "retry"
                ? { attempt: sessionStatus.attempt, next: sessionStatus.next }
                : null))
            : null,
        interruptReason:
          status === "interrupted" ? (signal?.interruptReason ?? null) : null,
        metrics,
        isRoot: session.parentID === undefined,
        currentTool: base.currentTool,
        // El paralelismo es una propiedad de la vista (depende del subárbol y
        // de `now`); se completa en `useGraphModel`.
        parallel: null,
        enrichment,
      },
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: TGraphEdge[] = sessions
    .filter((s) => s.parentID !== undefined && nodeIds.has(s.parentID))
    .map((s) => ({
      id: `${s.parentID}->${s.id}`,
      source: s.parentID as string,
      target: s.id,
      type: "agent" as const,
    }));

  return { nodes, edges };
};
