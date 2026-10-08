import type { QueryClient } from '@tanstack/react-query';
import type {
  FormDetail,
  FormInfo,
  PermissionRequest,
  SessionStatus,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import type {
  TExecutionSignal,
  TGraphNode,
  TGraphNodeData,
} from '../Graph.entity';
import { deriveMetricBase, resolveMetrics } from './deriveMetrics';
import { toNodeStatus } from './nodeStatus';

/** Datos de caché ya resueltos que alimentan la fusión de un nodo. */
export interface TNodeEnrichmentInput {
  messages: TSessionMessage[];
  permissions: PermissionRequest[];
  formDetails: FormDetail[];
  signal: TExecutionSignal | undefined;
}

/**
 * Resuelve desde la caché compartida (las mismas claves que parchea
 * `eventReducer`) los datos que `enrichNodeData` fusiona: mensajes, permisos,
 * formularios y señal de ejecución. Deja a `enrichNodeData` puramente funcional.
 */
export const readNodeEnrichmentInput = (
  queryClient: QueryClient,
  id: string,
): TNodeEnrichmentInput => {
  const signals =
    queryClient.getQueryData<Record<string, TExecutionSignal>>(
      queryKeys.sessions.execution(id),
    ) ?? {};
  const formList =
    queryClient.getQueryData<FormInfo[]>(queryKeys.sessions.forms(id)) ?? [];
  const formDetails = formList
    .map((form) =>
      queryClient.getQueryData<FormDetail>([
        ...queryKeys.sessions.forms(id),
        form.id,
      ]),
    )
    .filter((detail): detail is FormDetail => detail !== undefined);

  return {
    messages:
      queryClient.getQueryData<TSessionMessage[]>(
        queryKeys.sessions.messages(id),
      ) ?? [],
    permissions:
      queryClient.getQueryData<PermissionRequest[]>(
        queryKeys.permissions.for(id),
      ) ?? [],
    formDetails,
    signal: signals[id],
  };
};

export interface TEnrichNodeDataInput extends TNodeEnrichmentInput {
  node: TGraphNode;
  sessionStatus: SessionStatus | undefined;
  now: number;
}

/**
 * Fusiona en un nodo estructural los datos que dependen del contenido cargado
 * (métricas, estado final, `model`, `currentTool`) y lo marca `'ready'`. Es la
 * misma lógica que `buildGraph` (R1/R3): la base de métricas es independiente
 * del reloj y el estado se resuelve con `toNodeStatus`.
 */
export const enrichNodeData = ({
  node,
  messages,
  permissions,
  formDetails,
  sessionStatus,
  signal,
  now,
}: TEnrichNodeDataInput): TGraphNodeData => {
  const { id } = node;
  const base = deriveMetricBase(messages);
  const status = toNodeStatus({
    status: sessionStatus,
    hasActivity: messages.length > 0,
    hasPermission: permissions.length > 0,
    hasPendingForm: formDetails.some(
      (form) => form.sessionID === id && form.state.status === 'pending',
    ),
    compaction: signal?.compaction ?? null,
    outcome: signal?.outcome ?? null,
    lastAssistantErrored: base.lastAssistantErrored,
  });

  return {
    ...node.data,
    // `buildGraph` cae al modelo del agente cuando los mensajes no lo traen; en
    // la estructura ese fallback ya quedó en `node.data.model`, así que se
    // conserva (paridad FR-007).
    model: base.model ?? node.data.model,
    status,
    retry:
      status === 'retrying'
        ? (signal?.retry ??
          (sessionStatus?.type === 'retry'
            ? { attempt: sessionStatus.attempt, next: sessionStatus.next }
            : null))
        : null,
    interruptReason:
      status === 'interrupted' ? (signal?.interruptReason ?? null) : null,
    metrics: resolveMetrics(base, sessionStatus, now, 0),
    currentTool: base.currentTool,
    enrichment: 'ready',
  };
};
