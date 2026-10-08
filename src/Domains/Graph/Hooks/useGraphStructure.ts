import { useMemo, useState } from 'react';
import type { SessionInfo } from '@opencode/client';
import {
  useGetAgents,
  useGetSessions,
  useGetSessionStatus,
} from '../../Sessions/Sessions.service';
import {
  EMPTY_METRICS,
  type TGraphModel,
  type TNodeParallelism,
  type TParallelGroup,
} from '../Graph.entity';
import { buildGraph } from '../lib/buildGraph';
import {
  deriveExecutionLevels,
  layoutExecution,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { topologySignature } from '../lib/layoutGraph';
import { isActiveStatus } from '../lib/nodeStatus';
import { deriveParallelGroups } from '../lib/parallelism';

/**
 * Modelo **estructural** del grafo (contrato de carga §1.1, data-model §3): la
 * primera fase del modelo por fases. Se deriva **solo** de consultas ya
 * cacheadas —sesiones (`queryKeys.sessions.list(directory)`), estados
 * (`queryKeys.sessions.status()`) y agentes (`queryKeys.agents.list(directory)`)
 * — y **no** abre ninguna consulta de contenido (mensajes, log, permisos,
 * formularios o inbox), de modo que el grafo se pinta sin esperar al volumen de
 * contenido (FR-010, SC-007, criterio L4).
 *
 * Los nodos salen con `enrichment: 'pending'` y `metrics: EMPTY_METRICS`; el
 * enriquecimiento los completa y los marca `'ready'`. En esta fase solo
 * son **definitivos** los estados derivables de `SessionStatus`
 * (`running`/`retrying`/`created`); `compacting`, las esperas y los terminales
 * quedan provisionales hasta el enriquecimiento (data-model §2.2).
 */
export interface UseGraphStructureResult {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  /** Niveles de ejecución (tandas) y posiciones derivadas, para el layout. */
  executionPlan: TExecutionPlan;
  activeNodeId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * BFS del subárbol desde `rootId` siguiendo `parentID`, con índice `Map` para
 * resolver en O(n) (R4). Es la misma construcción estructural que necesita el
 * modelo por fases; vive aquí porque esta es la fase que posee la topología.
 */
export const filterSubtree = (
  sessions: SessionInfo[],
  rootId: string | null,
): SessionInfo[] => {
  if (!rootId) return [];
  const byId = new Map<string, SessionInfo>();
  const byParent = new Map<string, SessionInfo[]>();
  for (const session of sessions) {
    if (!byId.has(session.id)) byId.set(session.id, session);
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
    const session = byId.get(id);
    if (!session) continue;
    result.push(session);
    for (const child of byParent.get(id) ?? []) queue.push(child.id);
  }
  return result;
};

export const useGraphStructure = (
  sessionId: string | null,
  directory: string | null,
): UseGraphStructureResult => {
  const sessionsQuery = useGetSessions(directory);
  const statusQuery = useGetSessionStatus();
  const agentsQuery = useGetAgents(directory);

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const related = useMemo(
    () => filterSubtree(sessions, sessionId),
    [sessions, sessionId],
  );

  // `now` estable: la fase estructural no avanza con el reloj (las métricas
  // están vacías), solo lo usa el layout/paralelismo como fallback cuando una
  // sesión no reporta `updatedAt`. Así la estructura no añade re-renders por
  // tick (FR-006/SC-005); el reloj en vivo lo resuelve el enriquecimiento.
  const [now] = useState(() => Date.now());

  const model = useMemo<TGraphModel>(() => {
    const structural = buildGraph({
      sessions: related,
      statuses: statusQuery.data ?? {},
      agents: agentsQuery.data ?? [],
      // Sin contenido: la estructura no depende de mensajes/log/permisos/etc.
      messages: {},
      permissions: [],
      signals: {},
      forms: [],
      inbox: [],
      enrichment: 'pending',
      now,
    });
    // `buildGraph` con contenido vacío ya produce métricas vacías salvo por el
    // `retryCount`/`loopEvidence` derivados del `SessionStatus` retry; se fija
    // `EMPTY_METRICS` para que la fase estructural sea exactamente vacía.
    return {
      ...structural,
      nodes: structural.nodes.map((node) => ({
        ...node,
        data: { ...node.data, metrics: EMPTY_METRICS },
      })),
    };
  }, [related, statusQuery.data, agentsQuery.data, now]);

  const signature = topologySignature(model);

  // El plan de ejecución se memoiza por firma de topología: el orden temporal de
  // las sesiones ya creadas es estable, así que no se recalcula por datos.
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

  // El paralelismo se apoya en los tiempos de sesión (`createdAt`/`updatedAt`),
  // que ya son estructurales; se completa en el enriquecimiento si hace falta.
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
