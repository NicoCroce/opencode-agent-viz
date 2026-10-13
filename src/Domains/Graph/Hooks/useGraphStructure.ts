import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import {
  useGetAgents,
  useGetSessionActivity,
  useGetSessionStatus,
} from '../../Sessions/Sessions.service';
import { type TGraphModel, type TParallelGroup } from '../Graph.entity';
import { assembleStructuralGraph } from '../lib/assembleStructuralGraph';
import { buildStructuralModel } from '../lib/buildStructuralModel';
import {
  deriveExecutionKey,
  deriveExecutionLevels,
  layoutExecution,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { filterSubtree } from '../lib/filterSubtree';
import { indexPositions } from '../lib/indexPositions';
import { loadSubtree, type TSubtreeLoadResult } from '../lib/loadPlan/subtree';
import { isActiveStatus } from '../lib/nodeStatus';
import { deriveExecutionBatches, toParallelByNode } from '../lib/parallelByNode';

/**
 * El BFS del subárbol (`filterSubtree`) vive en `lib/` como función pura
 * (DC-16); se reexporta desde aquí para conservar la API pública que
 * `useGraphModel` y el barrel de `Hooks` ya exponían. El **origen estructural**
 * del grafo ya no es `filterSubtree`: es el cargador del subárbol (FR-013).
 */
export { filterSubtree };

/**
 * Modelo **estructural** del grafo (contrato de carga §1.1, contrato de subárbol
 * §3, data-model §3): la primera fase del modelo por fases. Se deriva **solo** de
 * consultas ya cacheadas —subárbol (`sessions.roots` + `sessions.children`),
 * estados (`sessions.status`), actividad (`sessions.activity`) y agentes
 * (`agents.list(directory)`)— y **no** abre ninguna consulta de contenido
 * (mensajes, log, permisos, formularios o inbox), de modo que el grafo se pinta
 * sin esperar al volumen de contenido (FR-010, SC-007, criterio L4).
 *
 * El origen es el **subárbol de la sesión abierta** (`loadSubtree`), no la
 * ventana global de `sessions.list`: las hijas de subagente ya no desplazan a
 * los hermanos fuera de la ventana (FR-013).
 *
 * Los nodos salen con `enrichment: 'pending'` y `metrics: EMPTY_METRICS`; el
 * enriquecimiento los completa y los marca `'ready'`. En esta fase solo
 * son **definitivos** los estados derivables de `SessionStatus`
 * (`running`/`retrying`/`created`); `compacting`, las esperas y los terminales
 * quedan provisionales hasta el enriquecimiento (data-model §2.2).
 */
/**
 * Estado de resolución del `directory` de la sesión abierta (Principio VI,
 * contrato de subárbol §4). Lo produce `useSessionDirectory` en `Sessions` y lo
 * propaga `WorkspacePage` (Infrastructure) hasta la estructura: sin él, un
 * `directory` nulo era indistinguible de "aún resolviendo" y la vista quedaba
 * en **esqueleto terminal** (FR-004/SC-002).
 *
 * Es un tipo **estructural** propio del dominio `Graph` (Principio II): no
 * deep-importa el de `Sessions`; solo describe lo que la estructura necesita.
 */
export interface TDirectoryResolution {
  /** El respaldo del `directory` (`session.get`) sigue en vuelo. */
  isLoading: boolean;
  /** El respaldo terminó **sin** resolver el `directory` (sesión inexistente). */
  isError: boolean;
}

export interface UseGraphStructureResult {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  /** Niveles de ejecución (tandas) y posiciones derivadas, para el layout. */
  executionPlan: TExecutionPlan;
  activeNodeId: string | null;
  /**
   * El subárbol se cortó por el presupuesto **global** de nodos (FR-006,
   * SC-009). Aditivo: el aviso del banner lo consume `useGraphModel`.
   */
  truncated: boolean;
  /** Motivo del corte cuando `truncated`; `null` si el subárbol está completo. */
  reason: string | null;
  /** Nº de sesiones del subárbol cargado (instrumentación, data-model §3). */
  loadedCount: number;
  /**
   * La sesión abierta no existe (FR-005): estado "no encontrada", **distinto**
   * de error y de "sin agentes" (contrato de subárbol §4). Se deriva de dos
   * fuentes: el cargador del subárbol (`data.notFound`, con `directory` ya
   * resuelto) **y** la resolución del `directory` —si la sesión no se pudo
   * resolver, `notFound` es alcanzable incluso sin `directory`—.
   */
  notFound: boolean;
  /**
   * `isLoading = isFetching(directorio) || isLoading(estructura)` (contrato de
   * subárbol §4): mientras el `directory` se resuelve, la carga es **acotada**
   * (termina al resolver o fallar), nunca terminal (SC-002).
   */
  isLoading: boolean;
  /** `isError(estructura)`: fallo de red/servidor al cargar el subárbol. */
  isError: boolean;
  error: Error | null;
}

export const useGraphStructure = (
  sessionId: string | null,
  directory: string | null,
  directoryResolution?: TDirectoryResolution,
): UseGraphStructureResult => {
  const queryClient = useQueryClient();
  const statusQuery = useGetSessionStatus();
  const activityQuery = useGetSessionActivity();
  const agentsQuery = useGetAgents(directory);

  const subtreeKey = useMemo(
    () => queryKeys.graph.for(directory ?? '', sessionId ?? ''),
    [directory, sessionId],
  );

  /**
   * El subárbol se carga **bajo demanda** (R4) y su resultado se cachea en
   * `graph.*`: así los 8 tipos de evento de sesión no re-ejecutan el BFS. El
   * cargador recibe las dependencias inyectadas (`roots` de `sessions.roots`,
   * `getSession`, `listChildren` de `sessions.children`), de modo que el BFS
   * queda cacheado por padre y el cargador sigue siendo puro y testeable.
   */
  const subtreeQuery = useQuery<TSubtreeLoadResult>({
    queryKey: subtreeKey,
    // Sin sesión o sin directorio no hay subárbol que cargar (el `directory`
    // puede seguir resolviéndose en `useSessionDirectory`).
    enabled: sessionId !== null && directory !== null,
    queryFn: async () => {
      const rootDirectory = directory as string;
      const { sessions: roots } = await queryClient.fetchQuery({
        queryKey: queryKeys.sessions.roots(rootDirectory),
        queryFn: () => opencodeService.listRootSessions(rootDirectory),
      });
      return loadSubtree({
        sessionId: sessionId as string,
        roots,
        getSession: (id) => opencodeService.getSession(id),
        listChildren: (parentID) =>
          queryClient.fetchQuery({
            queryKey: queryKeys.sessions.children(parentID),
            queryFn: () => opencodeService.listChildSessions(parentID),
          }),
      });
    },
  });

  const subtree = useMemo(
    () => subtreeQuery.data?.sessions ?? [],
    [subtreeQuery.data],
  );

  // Raíz observada: la primera (y única) sesión del subárbol sin `parentID`.
  const rootId = useMemo(
    () => subtree.find((session) => session.parentID === undefined)?.id ?? null,
    [subtree],
  );

  /**
   * Frescura en vivo (contrato de subárbol §2, R4): el árbol se refresca
   * refrescando **explícitamente la profundidad 1** de la raíz observada. V2 no
   * trae `parentID` en `session.created`, así que no se puede invalidar la key
   * exacta del padre: se mantiene **viva** la consulta de hijas de la raíz (la
   * invalidación por prefijo de `sessions.all` la alcanza) y, cuando el conjunto
   * de hijas directas cambia, se re-ejecuta el BFS del subárbol. Sin cambio en la
   * profundidad 1 no hay refetch: el coste no escala con los eventos no
   * estructurales (Principio VII).
   */
  const depthOneQuery = useQuery({
    queryKey: queryKeys.sessions.children(rootId ?? ''),
    queryFn: () => opencodeService.listChildSessions(rootId as string),
    enabled: rootId !== null,
  });

  const depthOneIds = useMemo(
    () =>
      (depthOneQuery.data ?? [])
        .map((child) => child.id)
        .sort()
        .join('|'),
    [depthOneQuery.data],
  );
  const depthOneRef = useRef<{ rootId: string; ids: string } | null>(null);

  useEffect(() => {
    if (rootId === null || depthOneQuery.data === undefined) return;
    const previous = depthOneRef.current;
    depthOneRef.current = { rootId, ids: depthOneIds };
    const topologyChanged =
      previous !== null &&
      previous.rootId === rootId &&
      previous.ids !== depthOneIds;
    if (topologyChanged) {
      void queryClient.invalidateQueries({ queryKey: subtreeKey });
    }
  }, [rootId, depthOneIds, depthOneQuery.data, subtreeKey, queryClient]);

  // `now` estable: la fase estructural no avanza con el reloj (las métricas
  // están vacías), solo lo usa el layout/paralelismo como fallback cuando una
  // sesión no reporta `updatedAt`. Así la estructura no añade re-renders por
  // tick (FR-006/SC-005); el reloj en vivo lo resuelve el enriquecimiento.
  const [now] = useState(() => Date.now());

  const model = useMemo(
    () =>
      buildStructuralModel({
        sessions: subtree,
        statuses: statusQuery.data ?? {},
        agents: agentsQuery.data ?? [],
        activity: activityQuery.data ?? {},
        now,
      }),
    [subtree, statusQuery.data, agentsQuery.data, activityQuery.data, now],
  );

  // Clave de ejecución (topología + clase/borde de intervalo): el plan,
  // las posiciones y los grupos se memoizan por ella, no por la firma de
  // topología, para reaccionar a la transición activo↔terminado y al cambio
  // del fin real de un terminado sin relayout por eventos no estructurales ni
  // por tick (FR-003, FR-007/SC-004, research R3).
  const executionKey = deriveExecutionKey(model);

  // Los lotes de ejecución se derivan **una sola vez** por clave de ejecución
  // (una única fusión: invocación del padre si existe, solape de sesión si no) y
  // se **inyectan** a filas y badge, de modo que ambos salen del mismo cómputo y
  // la paridad fila ↔ badge queda garantizada por construcción (FR-008, E5).
  // Evita repetir el respaldo por solape de hermanos, que es O(n²) (Principio
  // VII); sin lotes/invocaciones el respaldo es `deriveSiblingBatches`, idéntico
  // a hoy (FR-012).
  const executionGroups = useMemo(
    () => deriveExecutionBatches(model, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executionKey],
  );

  // El plan de ejecución se memoiza por la clave de ejecución: el orden temporal
  // de las sesiones ya creadas es estable, así que no se recalcula por datos. Los
  // lotes se **inyectan** (cuarto argumento) para no reagrupar.
  const executionPlan = useMemo(
    () => deriveExecutionLevels(model, now, [], executionGroups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executionKey],
  );

  const positions = useMemo(
    () => indexPositions(layoutExecution(model, executionPlan).nodes),
    // Intentionally keyed by the execution key, not by `model` identity:
    // status/metrics updates must not trigger a relayout (Principio VII).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executionKey],
  );

  // El paralelismo se apoya en los tiempos de sesión (`createdAt`/`updatedAt`),
  // que ya son estructurales; se completa en el enriquecimiento si hace falta.
  // El badge sale de los **mismos** lotes que las filas (no se reagrupa): así un
  // nodo con fila paralela no puede quedarse sin badge (FR-010, E5, research R3).
  const parallelGroups = useMemo(
    () => executionGroups.filter((group) => group.nodeIds.length >= 2),
    [executionGroups],
  );

  const parallelByNode = useMemo(
    () => toParallelByNode(parallelGroups),
    [parallelGroups],
  );

  const graph = useMemo<TGraphModel>(
    () => assembleStructuralGraph(model, positions, parallelByNode),
    [model, positions, parallelByNode],
  );

  // El nodo activo es el primero con un estado de ejecución en curso
  // (running/retrying/compacting/esperas), no solo `running` (FR-017).
  const activeNodeId =
    graph.nodes.find((node) => isActiveStatus(node.data.status))?.id ?? null;

  // --- Resolución del directorio (Principio VI, contrato de subárbol §4) -----
  // Por defecto, sin sesión o con `directory` ya resuelto no hay nada pendiente;
  // si hay sesión y aún no hay `directory` pero nadie declaró su resolución, se
  // asume **en curso**: esqueleto acotado (nunca terminal) para los llamadores
  // que no propagan el estado (p. ej. tests de contrato con 2 argumentos).
  const resolution: TDirectoryResolution =
    directoryResolution ??
    (directory !== null
      ? { isLoading: false, isError: false }
      : { isLoading: true, isError: false });

  const hasSession = sessionId !== null;
  // El `directory` sigue resolviéndose: carga legítima y acotada (FR-004).
  const directoryPending =
    hasSession && directory === null && resolution.isLoading;
  // El respaldo del `directory` terminó **sin** resolverlo: la sesión abierta no
  // existe (FR-005). Es el desenlace que documenta `useSessionDirectory` y, sin
  // esta derivación, `notFound` era **inalcanzable**: el cargador del subárbol
  // no corre sin `directory`, así que la vista quedaba en esqueleto terminal.
  const sessionNotFound =
    hasSession && directory === null && !resolution.isLoading && resolution.isError;

  return {
    graph,
    parallelGroups,
    executionPlan,
    activeNodeId,
    truncated: subtreeQuery.data?.truncated ?? false,
    reason: subtreeQuery.data?.reason ?? null,
    loadedCount: subtreeQuery.data?.loadedCount ?? 0,
    notFound: subtreeQuery.data?.notFound === true || sessionNotFound,
    // Mientras el directorio del proyecto se resuelve (o el subárbol carga) el
    // esqueleto es legítimo; ambas cargas son **acotadas** (terminan al resolver
    // o fallar), nunca terminales (contrato de subárbol §4, FR-004/SC-002).
    isLoading: directoryPending || subtreeQuery.isLoading,
    isError: subtreeQuery.isError,
    error: subtreeQuery.error ?? null,
  };
};
