import type {
  AgentInfo,
  FormDetail,
  PermissionRequest,
  SessionInboxInfo,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";
import type {
  TExecutionSignal,
  TGraphEdge,
  TGraphModel,
  TGraphNode,
} from "../Graph.entity";
import { deriveMetrics, type TSessionMessageLike } from "./deriveMetrics";
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
  now: number;
}

const resolveModel = (
  messages: TSessionMessageLike[] | undefined,
): TGraphNode["data"]["model"] => {
  if (!messages) return null;
  for (const { info } of messages) {
    if (info.type === "assistant") return info.model;
  }
  return null;
};

const hasError = (messages: TSessionMessageLike[] | undefined): boolean => {
  if (!messages) return false;
  return messages.some(({ info, parts }) => {
    if (info.type === "assistant" && info.error) return true;
    return parts.some((p) => p.type === "tool" && p.state.status === "error");
  });
};

const currentTool = (
  messages: TSessionMessageLike[] | undefined,
): { name: string; state: string } | null => {
  if (!messages) return null;
  let found: { name: string; state: string } | null = null;
  for (const { parts } of messages) {
    for (const part of parts) {
      if (part.type !== "tool") continue;
      found = { name: part.name, state: part.state.status };
    }
  }
  return found;
};

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

    const metrics = deriveMetrics({
      messages: sessionMessages ?? [],
      status: sessionStatus,
      now,
    });

    const status = toNodeStatus({
      status: sessionStatus,
      hasActivity: (sessionMessages?.length ?? 0) > 0,
      hasPermission: permission,
      hasPendingForm: hasPendingForm(forms, session.id),
      compaction: signal?.compaction ?? null,
      outcome: signal?.outcome ?? null,
      lastAssistantErrored: hasError(sessionMessages),
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
        model: resolveModel(sessionMessages) ?? agent?.model ?? null,
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
        currentTool: currentTool(sessionMessages),
        // El paralelismo es una propiedad de la vista (depende del subárbol y
        // de `now`); se completa en `useGraphModel`.
        parallel: null,
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
