import { useEffect, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { SessionInfo } from '@opencode/client';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { useGetAgents, useGetSessions, useGetSessionStatus } from '../../Sessions/Sessions.service';
import { buildGraph } from '../lib/buildGraph';
import type { TSessionMessageLike } from '../lib/deriveMetrics';
import {
  deriveExecutionLevels,
  layoutExecution,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { topologySignature } from '../lib/layoutGraph';
import { isActiveStatus } from '../lib/nodeStatus';
import { deriveParallelGroups } from '../lib/parallelism';
import type {
  TExecutionSignal,
  TGraphModel,
  TNodeParallelism,
  TParallelGroup,
} from '../Graph.entity';
import { deriveExecutionSignals, EMPTY_EXECUTION_SIGNAL } from './useExecutionSignals';
import { useNow } from './useNow';

export const filterSubtree = (
  sessions: SessionInfo[],
  rootId: string | null,
): SessionInfo[] => {
  if (!rootId) return [];
  const byParent = new Map<string, SessionInfo[]>();
  for (const session of sessions) {
    if (session.parentID === undefined) continue;
    const list = byParent.get(session.parentID) ?? [];
    list.push(session);
    byParent.set(session.parentID, list);
  }

  const result: SessionInfo[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const session = sessions.find((s) => s.id === id);
    if (!session) continue;
    result.push(session);
    for (const child of byParent.get(id) ?? []) queue.push(child.id);
  }
  return result;
};

/** Compara dos señales campo a campo para evitar escrituras redundantes en caché. */
const sameSignal = (a: TExecutionSignal, b: TExecutionSignal): boolean =>
  (a.retry?.attempt ?? null) === (b.retry?.attempt ?? null) &&
  (a.retry?.next ?? null) === (b.retry?.next ?? null) &&
  a.compaction === b.compaction &&
  a.outcome === b.outcome &&
  a.interruptReason === b.interruptReason;

/**
 * Combina la siembra durable con la caché en vivo: los campos que ya reportó un
 * evento en vivo ganan sobre los reconstruidos del log; el resto se completa con
 * la siembra. Misma precedencia que `useExecutionSignals`.
 */
const mergeSignal = (
  seed: TExecutionSignal,
  live: TExecutionSignal | undefined,
): TExecutionSignal => ({
  retry: live?.retry ?? seed.retry,
  compaction: live?.compaction ?? seed.compaction,
  outcome: live?.outcome ?? seed.outcome,
  interruptReason: live?.interruptReason ?? seed.interruptReason,
});

export interface UseGraphModelResult {
  graph: TGraphModel;
  /** Grupos de agentes que corrieron en paralelo en el subárbol visible. */
  parallelGroups: TParallelGroup[];
  /** Niveles de ejecución (tandas) y posiciones derivadas, para el layout. */
  executionPlan: TExecutionPlan;
  activeNodeId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export const useGraphModel = (
  sessionId: string | null,
  directory: string | null,
): UseGraphModelResult => {
  const queryClient = useQueryClient();
  const sessionsQuery = useGetSessions(directory);
  const statusQuery = useGetSessionStatus();
  const agentsQuery = useGetAgents(directory);

  const now = useNow(1000, Boolean(sessionId));

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const related = useMemo(
    () => filterSubtree(sessions, sessionId),
    [sessions, sessionId],
  );
  const ids = useMemo(() => related.map((s) => s.id), [related]);

  // `permission.list` es por sesión en V2, así que se pide junto a los mensajes
  // del subárbol en lugar de mantener una lista global ficticia.
  const messageQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.sessions.messages(id),
      queryFn: () => opencodeService.getSessionMessages(id),
      staleTime: Infinity,
    })),
  });

  const permissionQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.permissions.for(id),
      queryFn: () => opencodeService.getSessionPermissions(id),
      staleTime: Infinity,
    })),
  });

  // Señales de ejecución (FR-018/FR-019) de TODO el subárbol: `useExecutionSignals`
  // solo cubre una sesión y no se puede invocar un hook por nodo, así que se
  // reutiliza su núcleo puro (`deriveExecutionSignals`) para sembrar el log
  // durable de cada sesión y se lee la caché en vivo que parchea `eventReducer`.
  const logQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.sessions.log(id),
      queryFn: () => opencodeService.getSessionLog(id),
      staleTime: Infinity,
    })),
  });

  const seeds = useMemo(() => {
    const map: Record<string, TExecutionSignal> = {};
    ids.forEach((id, index) => {
      const data = logQueries[index]?.data;
      if (data) map[id] = deriveExecutionSignals(data, id);
    });
    return map;
  }, [ids, logQueries]);

  // Escribe la siembra en la caché en vivo una vez por sesión, para que los
  // parches posteriores de `eventReducer` la preserven (su `updater` parte del
  // valor cacheado). La escritura es idempotente: si la señal ya coincide, se
  // devuelve el mismo objeto y no se notifica a los observadores.
  useEffect(() => {
    for (const id of ids) {
      const seed = seeds[id];
      if (!seed) continue;
      queryClient.setQueryData<Record<string, TExecutionSignal>>(
        queryKeys.sessions.execution(id),
        (prev) => {
          const current = prev?.[id];
          const merged = mergeSignal(seed, current);
          if (current && sameSignal(current, merged)) return prev;
          return { ...(prev ?? {}), [id]: merged };
        },
      );
    }
  }, [queryClient, ids, seeds]);

  // Lector reactivo de la caché en vivo, por sesión. El `queryFn` no se ejecuta
  // (hay `initialData` y `staleTime: Infinity`); devuelve lo cacheado si por
  // algún motivo se disparara.
  const liveQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.sessions.execution(id),
      queryFn: () =>
        Promise.resolve(
          queryClient.getQueryData<Record<string, TExecutionSignal>>(
            queryKeys.sessions.execution(id),
          ) ?? {},
        ),
      staleTime: Infinity,
      initialData: {},
    })),
  });

  const signals = useMemo(() => {
    const map: Record<string, TExecutionSignal> = {};
    ids.forEach((id, index) => {
      map[id] =
        liveQueries[index]?.data?.[id] ?? seeds[id] ?? EMPTY_EXECUTION_SIGNAL;
    });
    return map;
  }, [ids, liveQueries, seeds]);

  // Formularios (preguntas al usuario, FR-032): `session.form.list` no trae el
  // estado resuelto, así que cada formulario se completa con `session.form.get`
  // para saber si está `pending`/`answered`/`cancelled`.
  const formListQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.sessions.forms(id),
      queryFn: () => opencodeService.listSessionForms(id),
      staleTime: Infinity,
    })),
  });

  const formRefs = formListQueries.flatMap((query, index) =>
    (query.data ?? []).map((form) => ({
      sessionID: ids[index],
      formID: form.id,
    })),
  );

  const formDetailQueries = useQueries({
    queries: formRefs.map((ref) => ({
      queryKey: [...queryKeys.sessions.forms(ref.sessionID), ref.formID],
      queryFn: () => opencodeService.getSessionForm(ref.sessionID, ref.formID),
      staleTime: Infinity,
    })),
  });

  // Inbox (FR-034): se entrega completo a `buildGraph` por nodo; la cola de
  // turnos se muestra en el detalle del agente, no tiñe `TNodeStatus`.
  const inboxQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.sessions.inbox(id),
      queryFn: () => opencodeService.listSessionInbox(id),
      staleTime: Infinity,
    })),
  });

  const messagesMap = useMemo(() => {
    const map: Record<string, TSessionMessageLike[]> = {};
    ids.forEach((id, index) => {
      const data = messageQueries[index]?.data;
      if (data) map[id] = data;
    });
    return map;
  }, [ids, messageQueries]);

  const permissions = useMemo(
    () => permissionQueries.flatMap((query) => query.data ?? []),
    [permissionQueries],
  );

  const forms = useMemo(
    () => formDetailQueries.flatMap((query) => query.data ?? []),
    [formDetailQueries],
  );

  const inbox = useMemo(
    () => inboxQueries.flatMap((query) => query.data ?? []),
    [inboxQueries],
  );

  const model = useMemo(
    () =>
      buildGraph({
        sessions: related,
        statuses: statusQuery.data ?? {},
        agents: agentsQuery.data ?? [],
        messages: messagesMap,
        permissions,
        signals,
        forms,
        inbox,
        now,
      }),
    [
      related,
      statusQuery.data,
      agentsQuery.data,
      messagesMap,
      permissions,
      signals,
      forms,
      inbox,
      now,
    ],
  );

  const signature = topologySignature(model);

  // El plan de ejecución (niveles por tanda) se memoiza por firma de topología:
  // el orden temporal de las sesiones ya creadas es estable, así que no hace
  // falta recalcularlo en cada tick (Principio VII).
  const executionPlan = useMemo(
    () => deriveExecutionLevels(model, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  const positions = useMemo(() => {
    const laidOut = layoutExecution(model, executionPlan);
    return Object.fromEntries(
      laidOut.nodes.map((node) => [node.id, node.position]),
    );
    // Intentionally keyed by topology signature, not by `model` identity:
    // status/metrics updates must not trigger a relayout (Principio VII).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Los grupos de paralelismo dependen del tiempo de ejecución, así que se
  // recalculan con `now` (igual que las métricas), sin tocar el layout.
  const parallelGroups = useMemo(
    () => deriveParallelGroups(model, now),
    [model, now],
  );

  const parallelByNode = useMemo(() => {
    const map: Record<string, TNodeParallelism> = {};
    for (const group of parallelGroups) {
      for (const id of group.nodeIds) {
        map[id] = { groupId: group.id, size: group.nodeIds.length };
      }
    }
    return map;
  }, [parallelGroups]);

  const graph = useMemo<TGraphModel>(
    () => ({
      edges: model.edges,
      nodes: model.nodes.map((node) => ({
        ...node,
        position: positions[node.id] ?? node.position,
        data: { ...node.data, parallel: parallelByNode[node.id] ?? null },
      })),
    }),
    [model, positions, parallelByNode],
  );

  // El nodo activo es el primero con un estado de ejecución en curso
  // (running/retrying/compacting/esperas), no solo `running` (FR-017).
  const activeNodeId =
    graph.nodes.find((node) => isActiveStatus(node.data.status))?.id ?? null;

  return {
    graph,
    parallelGroups,
    executionPlan,
    activeNodeId,
    // Mientras no sepamos el directorio del proyecto no podemos cargar nada.
    isLoading: Boolean(sessionId) && !directory ? true : sessionsQuery.isLoading,
    isError: sessionsQuery.isError,
    error: sessionsQuery.error ?? null,
  };
};
