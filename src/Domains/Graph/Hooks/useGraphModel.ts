import { useEffect, useMemo, useRef } from 'react';
import type { TGraphModel, TParallelGroup } from '../Graph.entity';
import {
  deriveExecutionKey,
  deriveExecutionLayout,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { assembleStructuralGraph } from '../lib/assembleStructuralGraph';
import { isActiveStatus } from '../lib/nodeStatus';
import { useGraphEnrichment } from './useGraphEnrichment';
import { useGraphStructure } from './useGraphStructure';
import { useNow } from './useNow';

/**
 * El BFS del subárbol (`filterSubtree`) vive ahora en `useGraphStructure`, la
 * fase que posee la topología (R4). Se reexporta desde aquí para conservar la
 * API pública que el barrel de `Hooks` ya exponía a través de `useGraphModel`.
 */
export { filterSubtree } from './useGraphStructure';

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

/**
 * Modelo por fases (contrato de carga §1, R1): compone la **estructura**
 * (`useGraphStructure`: sesiones + estados + agentes ya cacheados, con
 * `EMPTY_METRICS` y `enrichment: 'pending'`) con el **enriquecimiento**
 * (`useGraphEnrichment`: carga progresiva priorizada que completa métricas y
 * marca `enrichment: 'ready'`).
 *
 * Conserva **exactamente** la firma y la forma de `UseGraphModelResult` (L8):
 * `isLoading` sigue indicando que la estructura aún no está disponible y
 * `isError`/`error` siguen viniendo de `sessionsQuery` (FR-002, FR-008).
 */
export const useGraphModel = (
  sessionId: string | null,
  directory: string | null,
): UseGraphModelResult => {
  const structure = useGraphStructure(sessionId, directory);

  // Ids del subárbol estructural: la fase de enriquecimiento los consume junto
  // con la topología (`structure.graph`) para planificar la carga por lotes.
  const ids = useMemo(
    () => structure.graph.nodes.map((node) => node.id),
    [structure.graph.nodes],
  );

  const enriched = useGraphEnrichment(ids, structure.graph);

  // El tick se activa **solo** si hay al menos un nodo activo (FR-006, SC-005):
  // sin actividad, `now` no altera ninguna duración, así que no hay tick ni
  // re-renders (Principio VII). Se resuelve sobre `enriched` (estados finales,
  // ya definitivos) y no sobre el grafo posicionado para no crear una
  // dependencia circular con `now`.
  const hasActiveNode = useMemo(
    () => enriched.nodes.some((node) => isActiveStatus(node.data.status)),
    [enriched],
  );
  const now = useNow({ enabled: hasActiveNode });

  // `now` vivo leído vía ref (contract execution-lanes §5): el plan/paralelismo
  // autoritativo se recalcula **solo** cuando cambia la clave de ejecución
  // (nuevo nodo, transición activo↔terminado, cambio de fin real — FR-003), no
  // con cada tick. En ese instante se leen las ventanas informativas de los
  // carriles con el `now` vigente y quedan congeladas hasta el próximo cambio de
  // clave (A2); el tick de 1 s no relayouta (FR-007, SC-004, Principio VII).
  //
  // El ref se actualiza en efecto (no durante el render), como el resto de los
  // "latest refs" del repo; el memo lo lee puntualmente al derivar.
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  });

  // Clave de ejecución sobre el modelo **enriquecido**: el agrupamiento no
  // depende del reloj, solo de la topología y de la clase/borde de intervalo de
  // cada nodo (FR-008, Principio V).
  const executionKey = deriveExecutionKey(enriched);

  // Plan/paralelismo **autoritativo**: derivado de `enriched` (estados finales,
  // incluidos `compacting`/esperas) con la única lógica pura compartida
  // (`deriveExecutionLayout`): niveles/tandas, posiciones por carril/columna y
  // badge `parallel` de la misma lógica de intervalos (FR-010, contract §5).
  const layout = useMemo(
    () => {
      // eslint-disable-next-line react-hooks/refs -- lectura puntual del reloj vivo al derivar
      const nowAtDerive = nowRef.current;
      return deriveExecutionLayout(enriched, nowAtDerive);
    },
    // Intencionadamente memoizado por la clave de ejecución, no por `enriched`:
    // los eventos de contenido/estado no estructurales y el tick no recomputan
    // el plan (FR-007, SC-004; research R4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executionKey],
  );

  // Las posiciones y el badge se **congelan** con la clave de ejecución, pero los
  // **datos** del nodo (métricas, estado, tokens, `enrichment`) deben reflejar el
  // `enriched` vigente. Por eso se reensambla el grafo posicionado sobre el
  // modelo enriquecido actual —no sobre la copia capturada al derivar el plan—
  // reutilizando el mismo helper puro que la fase estructural.
  const positioned = useMemo(
    () =>
      assembleStructuralGraph(
        enriched,
        layout.positions,
        layout.parallelByNode,
      ),
    [enriched, layout],
  );

  // El tick de 1 s solo refresca `durationMs` sobre el grafo **posicionado**
  // (R3): la base de métricas es independiente del reloj y ya la resolvió el
  // enriquecimiento. Los nodos inactivos (`endedAt` fijado) conservan su objeto,
  // así que solo los activos cambian de duración y la posición no se toca.
  const graph = useMemo<TGraphModel>(() => {
    const nodes = positioned.nodes.map((node) => {
      const { metrics } = node.data;
      if (metrics.startedAt === null) return node;
      const durationMs = (metrics.endedAt ?? now) - metrics.startedAt;
      if (durationMs === metrics.durationMs) return node;
      return {
        ...node,
        data: { ...node.data, metrics: { ...metrics, durationMs } },
      };
    });
    return { nodes, edges: positioned.edges };
  }, [positioned, now]);

  // El nodo activo es el primero con un estado de ejecución en curso
  // (running/retrying/compacting/esperas), no solo `running` (FR-017). Se
  // resuelve sobre el modelo final para que los estados que solo son
  // definitivos tras el enriquecimiento (compacting/esperas) cuenten.
  const activeNodeId = useMemo(
    () =>
      graph.nodes.find((node) => isActiveStatus(node.data.status))?.id ?? null,
    [graph],
  );

  return {
    graph,
    parallelGroups: layout.parallelGroups,
    executionPlan: layout.plan,
    activeNodeId,
    // Mientras no sepamos el directorio del proyecto no podemos cargar nada; el
    // esqueleto sigue gobernado por la estructura (no por el enriquecimiento).
    isLoading: structure.isLoading,
    isError: structure.isError,
    error: structure.error,
  };
};
