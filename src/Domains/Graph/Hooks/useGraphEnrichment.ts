import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  FormDetail,
  FormInfo,
  PermissionRequest,
  SessionInfo,
  SessionStatus,
} from '@opencode/client';
import {
  opencodeService,
  type TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { useGetSessionStatus } from '../../Sessions/Sessions.service';
import type {
  TExecutionSignal,
  TGraphModel,
  TGraphNode,
  TGraphNodeData,
} from '../Graph.entity';
import { deriveMetricBase, resolveMetrics } from '../lib/deriveMetrics';
import {
  chunkLoadPlan,
  orderSubtreeForLoad,
  type TLoadPlan,
} from '../lib/loadPriority';
import { isActiveStatus, toNodeStatus } from '../lib/nodeStatus';
import { deriveExecutionSignals } from './useExecutionSignals';

/**
 * `useGraphEnrichment(ids, structure)` — segunda fase del modelo por fases
 * (contrato de carga §1.2, §2-§3; criterios L5..L6):
 *
 * - Consume el plan puro `orderSubtreeForLoad` + `chunkLoadPlan` (T016) y carga
 *   el contenido del subárbol **por lotes priorizados**, un lote por turno de
 *   idle (`requestIdleCallback` con fallback a `setTimeout`) para ceder el hilo
 *   sin congelar la UI (SC-007).
 * - Escribe en las **mismas claves** que parchea `eventReducer`
 *   (`sessions.messages`, `permissions.for`, `sessions.log`,
 *   `sessions.execution`, `sessions.forms`, `sessions.inbox`), de modo que la
 *   carga inicial y los eventos en vivo comparten caché (FR-009, R6).
 * - Fusiona métricas/estado final en los nodos ya cargados y los marca
 *   `enrichment: 'ready'`; el resto permanece `'pending'` (data-model §2.2).
 * - Al cambiar `ids`/`structure` (sesión nueva) el plan en vuelo se **reinicia**:
 *   los resultados del plan abandonado igual se escriben en caché (válidos y
 *   reutilizables, FR-004), pero no bloquean al nuevo (L6).
 *
 * `structure` es el `TGraphModel` estructural (`enrichment: 'pending'`,
 * `EMPTY_METRICS`): aporta la topología y los ids a enriquecer, y es la base
 * sobre la que se escriben los datos finales. Los nodos que no se han cargado
 * aún se devuelven tal cual (la estructura no bloquea el primer pintado).
 */

/** Set vacío compartido: identidad estable para el estado "sin progreso". */
const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/** Progreso de enriquecimiento ligado a la firma del subárbol actual (L6). */
interface TEnrichmentProgress {
  signature: string;
  ids: ReadonlySet<string>;
}

interface TIdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

interface TIdleScheduler {
  requestIdleCallback?: (callback: (deadline: TIdleDeadline) => void) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/**
 * Agenda un turno de idle: `requestIdleCallback` si existe (browser) y, en su
 * defecto, `setTimeout(..., 0)` (jsdom/entornos sin idle). Devuelve un cancelador
 * para abortar el turno si el plan se reinicia (L6).
 */
const scheduleIdle = (callback: () => void): { cancel: () => void } => {
  const scheduler = globalThis as unknown as TIdleScheduler;
  if (typeof scheduler.requestIdleCallback === 'function') {
    const handle = scheduler.requestIdleCallback(() => callback());
    return { cancel: () => scheduler.cancelIdleCallback?.(handle) };
  }
  const handle = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(handle) };
};

/**
 * Reconstruye la `SessionInfo` mínima que necesita `orderSubtreeForLoad`
 * (topología + `time.created`/`time.updated`) a partir de un nodo estructural.
 * La estructura no conserva la `SessionInfo` original, así que se rellenan los
 * campos no usados por el orden con valores neutros (Principio IV: no se
 * redefinen los tipos del SDK).
 */
const toSessionInfo = (
  node: TGraphNode,
  parentId: string | undefined,
): SessionInfo => ({
  id: node.id,
  ...(parentId === undefined ? {} : { parentID: parentId }),
  projectID: '',
  agent: node.data.agentName,
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: {
    created: node.data.createdAt ?? 0,
    updated: node.data.updatedAt ?? 0,
  },
  ...(node.data.title === null ? {} : { title: node.data.title }),
  location: { directory: node.data.directory },
});

/** Compara dos señales campo a campo para evitar escrituras redundantes. */
const sameSignal = (a: TExecutionSignal, b: TExecutionSignal): boolean =>
  (a.retry?.attempt ?? null) === (b.retry?.attempt ?? null) &&
  (a.retry?.next ?? null) === (b.retry?.next ?? null) &&
  a.compaction === b.compaction &&
  a.outcome === b.outcome &&
  a.interruptReason === b.interruptReason;

/**
 * Carga el contenido de una sesión, lo escribe en las claves compartidas con
 * `eventReducer` (R6) y siembra la señal de ejecución sin pisar lo que ya haya
 * reportado un evento en vivo (frescura, FR-009).
 */
const loadNodeContent = async (
  queryClient: QueryClient,
  id: string,
): Promise<void> => {
  const [messages, permissions, log, formList, inbox] = await Promise.all([
    opencodeService.getSessionMessages(id),
    opencodeService.getSessionPermissions(id),
    opencodeService.getSessionLog(id),
    opencodeService.listSessionForms(id),
    opencodeService.listSessionInbox(id),
  ]);

  const formDetails = await Promise.all(
    formList.map((form) => opencodeService.getSessionForm(id, form.id)),
  );

  queryClient.setQueryData(queryKeys.sessions.messages(id), messages);
  queryClient.setQueryData(queryKeys.permissions.for(id), permissions);
  queryClient.setQueryData(queryKeys.sessions.log(id), log);
  queryClient.setQueryData(queryKeys.sessions.forms(id), formList);
  for (const detail of formDetails) {
    queryClient.setQueryData(
      [...queryKeys.sessions.forms(id), detail.id],
      detail,
    );
  }
  queryClient.setQueryData(queryKeys.sessions.inbox(id), inbox);

  // La siembra durable completa la señal; los campos ya reportados en vivo
  // ganan (misma precedencia que `useGraphModel`/`useExecutionSignals`).
  const seed = deriveExecutionSignals(log, id);
  queryClient.setQueryData<Record<string, TExecutionSignal>>(
    queryKeys.sessions.execution(id),
    (prev) => {
      const current = prev?.[id];
      const merged: TExecutionSignal = {
        retry: current?.retry ?? seed.retry,
        compaction: current?.compaction ?? seed.compaction,
        outcome: current?.outcome ?? seed.outcome,
        interruptReason: current?.interruptReason ?? seed.interruptReason,
      };
      if (current && sameSignal(current, merged)) return prev;
      return { ...(prev ?? {}), [id]: merged };
    },
  );
};

/**
 * Fusiona en un nodo estructural los datos que dependen del contenido cargado
 * (métricas, estado final, `model`, `currentTool`) y lo marca `'ready'`. Es la
 * misma lógica que `buildGraph` (R1/R3): la base de métricas es independiente
 * del reloj y el estado se resuelve con `toNodeStatus`.
 */
const enrichNodeData = (
  queryClient: QueryClient,
  node: TGraphNode,
  statuses: Record<string, SessionStatus>,
  now: number,
): TGraphNodeData => {
  const { id } = node;
  const messages =
    queryClient.getQueryData<TSessionMessage[]>(
      queryKeys.sessions.messages(id),
    ) ?? [];
  const permissions =
    queryClient.getQueryData<PermissionRequest[]>(
      queryKeys.permissions.for(id),
    ) ?? [];
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

  const signal = signals[id];
  const sessionStatus = statuses[id];
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
    interruptReason: status === 'interrupted' ? (signal?.interruptReason ?? null) : null,
    metrics: resolveMetrics(base, sessionStatus, now, 0),
    currentTool: base.currentTool,
    enrichment: 'ready',
  };
};

export const useGraphEnrichment = (
  ids: string[],
  structure: TGraphModel,
): TGraphModel => {
  const queryClient = useQueryClient();
  const statusQuery = useGetSessionStatus();

  // Reloj estable de la fase de enriquecimiento: el tick en vivo lo resuelve
  // `useGraphModel` (US3); aquí solo se resuelve `durationMs` al completar cada
  // lote (data-model §2.1).
  const [now] = useState(() => Date.now());

  const signature = ids.join('\u0000');
  const [progress, setProgress] = useState<TEnrichmentProgress>(() => ({
    signature,
    ids: EMPTY_IDS,
  }));

  // Al cambiar el subárbol, el progreso del plan anterior no aplica: los nodos
  // del nuevo subárbol arrancan `pending` (L6). No se muta el estado: se
  // selecciona el set vacío si la firma no coincide.
  const enriched = progress.signature === signature ? progress.ids : EMPTY_IDS;

  // `readyIds` = lo ya procesado en esta visita ∪ lo que ya está en caché (una
  // revisita no repite trabajo, FR-004/SC-008). El plan excluye esos ids.
  const readyIds = useMemo(() => {
    const set = new Set<string>(enriched);
    for (const id of ids) {
      if (
        queryClient.getQueryData(queryKeys.sessions.messages(id)) !== undefined
      ) {
        set.add(id);
      }
    }
    return set;
  }, [enriched, ids, queryClient]);

  const plan: TLoadPlan = useMemo(() => {
    const parentOf = new Map(
      structure.edges.map((edge) => [edge.target, edge.source]),
    );
    const idSet = new Set(ids);
    const subtree = structure.nodes
      .filter((node) => idSet.has(node.id))
      .map((node) => toSessionInfo(node, parentOf.get(node.id)));
    const rootId =
      structure.nodes.find((node) => node.data.isRoot)?.id ?? ids[0] ?? '';
    const activeIds = new Set(
      structure.nodes
        .filter((node) => idSet.has(node.id) && isActiveStatus(node.data.status))
        .map((node) => node.id),
    );
    return orderSubtreeForLoad(subtree, {
      rootId,
      selectedId: null,
      activeIds,
      readyIds,
    });
  }, [structure, ids, readyIds]);

  // Un turno de idle por lote: carga el primer chunk pendiente, escribe la caché
  // y marca esos ids como procesados. Al reiniciarse el plan (cambia `plan`) el
  // turno en vuelo se cancela y el nuevo subárbol arranca de cero (L6).
  useEffect(() => {
    const chunk = chunkLoadPlan(plan.orderedIds)[0];
    if (!chunk) return;

    let cancelled = false;
    const idle = scheduleIdle(() => {
      void (async () => {
        try {
          await Promise.all(chunk.map((id) => loadNodeContent(queryClient, id)));
        } catch {
          // Un fallo de red deja el lote en `pending` (contrato de carga §3):
          // el estado de pantalla lo gobierna `sessionsQuery` (FR-008).
          return;
        }
        if (cancelled) return;
        setProgress((prev) => {
          const base =
            prev.signature === signature ? new Set(prev.ids) : new Set<string>();
          for (const id of chunk) base.add(id);
          return { signature, ids: base };
        });
      })();
    });

    return () => {
      cancelled = true;
      idle.cancel();
    };
  }, [plan, queryClient, signature]);

  return useMemo<TGraphModel>(() => {
    const statuses = statusQuery.data ?? {};
    const nodes = structure.nodes.map((node) =>
      readyIds.has(node.id)
        ? {
            ...node,
            data: enrichNodeData(queryClient, node, statuses, now),
          }
        : node,
    );
    return { nodes, edges: structure.edges };
  }, [structure, readyIds, statusQuery.data, queryClient, now]);
};
