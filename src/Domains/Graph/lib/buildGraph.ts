import type {
  AgentInfo,
  FormDetail,
  PermissionRequest,
  SessionInboxInfo,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";
import type {
  TActivityMap,
  TEnrichmentState,
  TExecutionSignal,
  TGraphEdge,
  TGraphModel,
  TGraphNode,
} from "../Graph.entity";
import type { TSessionMessageLike } from "./deriveMetrics";
import { buildEdges } from "./graphBuild/buildEdges";
import { toGraphNode } from "./graphBuild/toGraphNode";

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
  /**
   * Marca de última actividad observada por sesión
   * (`queryKeys.sessions.activity()`). Se propaga a `toGraphNode` para ampliar
   * el fin del intervalo de cada nodo (`updatedAt = max(lista, actividad)`,
   * contract session-activity §4). **Opcional** para preservar la paridad de
   * los consumidores previos: sin marca, `updatedAt` cae a `SessionInfo.time`.
   */
  activity?: TActivityMap;
  now: number;
}

export const buildGraph = ({
  sessions,
  statuses,
  agents,
  messages,
  permissions,
  signals,
  forms,
  enrichment = "ready",
  activity,
  now,
}: BuildGraphInput): TGraphModel => {
  const nodes: TGraphNode[] = sessions.map((session) =>
    toGraphNode(session, {
      statuses,
      agents,
      messages,
      permissions,
      signals,
      forms,
      enrichment,
      activity,
      now,
    }),
  );

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: TGraphEdge[] = buildEdges(sessions, nodeIds);

  return { nodes, edges };
};
