import { useMemo, useState } from 'react';
import {
  useGetAgents,
  useGetSessions,
  useGetSessionStatus,
} from '../../Sessions/Sessions.service';
import { type TGraphModel, type TParallelGroup } from '../Graph.entity';
import { assembleStructuralGraph } from '../lib/assembleStructuralGraph';
import { buildStructuralModel } from '../lib/buildStructuralModel';
import {
  deriveExecutionLevels,
  layoutExecution,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { filterSubtree } from '../lib/filterSubtree';
import { indexPositions } from '../lib/indexPositions';
import { topologySignature } from '../lib/layoutGraph';
import { isActiveStatus } from '../lib/nodeStatus';
import { toParallelByNode } from '../lib/parallelByNode';
import { deriveParallelGroups } from '../lib/parallelism';

/**
 * El BFS del subárbol (`filterSubtree`) vive en `lib/` como función pura
 * (DC-16); se reexporta desde aquí para conservar la API pública que
 * `useGraphModel` y el barrel de `Hooks` ya exponían.
 */
export { filterSubtree };

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

  const model = useMemo(
    () =>
      buildStructuralModel({
        sessions: related,
        statuses: statusQuery.data ?? {},
        agents: agentsQuery.data ?? [],
        now,
      }),
    [related, statusQuery.data, agentsQuery.data, now],
  );

  const signature = topologySignature(model);

  // El plan de ejecución se memoiza por firma de topología: el orden temporal de
  // las sesiones ya creadas es estable, así que no se recalcula por datos.
  const executionPlan = useMemo(
    () => deriveExecutionLevels(model, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  const positions = useMemo(
    () => indexPositions(layoutExecution(model, executionPlan).nodes),
    // Intentionally keyed by topology signature, not by `model` identity:
    // status/metrics updates must not trigger a relayout (Principio VII).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  // El paralelismo se apoya en los tiempos de sesión (`createdAt`/`updatedAt`),
  // que ya son estructurales; se completa en el enriquecimiento si hace falta.
  const parallelGroups = useMemo(
    () => deriveParallelGroups(model, now),
    [model, now],
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
