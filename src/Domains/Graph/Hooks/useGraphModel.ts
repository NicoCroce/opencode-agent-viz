import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { SessionInfo } from '@opencode/client';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { useGetAgents, useGetSessions, useGetSessionStatus } from '../../Sessions/Sessions.service';
import { buildGraph } from '../lib/buildGraph';
import type { TSessionMessageLike } from '../lib/deriveMetrics';
import { layoutGraph, topologySignature } from '../lib/layoutGraph';
import { deriveParallelGroups } from '../lib/parallelism';
import type {
  TGraphModel,
  TNodeParallelism,
  TParallelGroup,
} from '../Graph.entity';
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

export interface UseGraphModelResult {
  graph: TGraphModel;
  /** Grupos de agentes que corrieron en paralelo en el subárbol visible. */
  parallelGroups: TParallelGroup[];
  activeNodeId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export const useGraphModel = (
  sessionId: string | null,
  directory: string | null,
): UseGraphModelResult => {
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

  const model = useMemo(
    () =>
      buildGraph({
        sessions: related,
        statuses: statusQuery.data ?? {},
        agents: agentsQuery.data ?? [],
        messages: messagesMap,
        permissions,
        now,
      }),
    [
      related,
      statusQuery.data,
      agentsQuery.data,
      messagesMap,
      permissions,
      now,
    ],
  );

  const signature = topologySignature(model);
  const positions = useMemo(() => {
    const laidOut = layoutGraph(model);
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

  const activeNodeId =
    graph.nodes.find(
      (n) => n.data.status === 'running' || n.data.status === 'waiting',
    )?.id ?? null;

  return {
    graph,
    parallelGroups,
    activeNodeId,
    // Mientras no sepamos el directorio del proyecto no podemos cargar nada.
    isLoading: Boolean(sessionId) && !directory ? true : sessionsQuery.isLoading,
    isError: sessionsQuery.isError,
    error: sessionsQuery.error ?? null,
  };
};
