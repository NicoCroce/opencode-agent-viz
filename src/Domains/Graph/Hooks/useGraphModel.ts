import { useEffect, useMemo, useRef } from 'react';
import { useAnomalyThreshold } from '@app/Application/Hooks';
import type {
  TGraphModel,
  TGraphNode,
  TParallelGroup,
} from '../Graph.entity';
import {
  deriveExecutionKey,
  deriveExecutionLayout,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { assembleStructuralGraph } from '../lib/assembleStructuralGraph';
import { latestActiveNodeId } from '../lib/activeNode';
import { deriveEffortByNode } from '../lib/effort/deriveEffort';
import { deriveSpeedupByNode } from '../lib/metrics/speedup';
import { sameNode } from '../lib/reconcile/comparators';
import { isActiveStatus } from '../lib/nodeStatus';
import { useGraphEnrichment, useInvocationBatches } from './useGraphEnrichment';
import { useGraphStructure, type TDirectoryResolution } from './useGraphStructure';
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
  /**
   * Id del nodo activo **más reciente** (FR-005): entre los activos, el de
   * mayor `activityStartOf`. Aditivo; `activeNodeId` se conserva (primer activo
   * en orden de nodo). Lo consume `useFollowMode` vía `WorkspacePage`.
   */
  latestActiveNodeId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /**
   * La sesión abierta **no existe** (FR-005): estado "no encontrada",
   * distinto de error y de "sin agentes" (contrato de subárbol §4). Aditivo
   * (R6): se propaga tal cual de la fase estructural y `GraphPane` lo sitúa
   * entre la carga acotada y el vacío.
   */
  notFound: boolean;
  /**
   * El subárbol se cortó por el presupuesto **global** de nodos (FR-006,
   * SC-009). Aditivo (R6): se propaga tal cual de la fase estructural para que
   * `GraphPane` pinte el aviso persistente y no bloqueante, sin romper la forma
   * pública de `UseGraphModelResult`.
   */
  truncated: boolean;
}

/**
 * Modelo por fases (contrato de carga §1, R1): compone la **estructura**
 * (`useGraphStructure`: sesiones + estados + agentes ya cacheados, con
 * `EMPTY_METRICS` y `enrichment: 'pending'`) con el **enriquecimiento**
 * (`useGraphEnrichment`: carga progresiva priorizada que completa métricas y
 * marca `enrichment: 'ready'`).
 *
 * Conserva la firma y la forma de `UseGraphModelResult` (L8): `isLoading` sigue
 * indicando que la estructura aún no está disponible y `isError`/`error` siguen
 * gobernados por la fase estructural (FR-002, FR-008). Las incorporaciones son
 * **aditivas** (R6): `notFound` (FR-005) y `truncated` (FR-006), propagados tal
 * cual de la estructura.
 *
 * El tercer argumento (`directoryResolution`) es **aditivo y opcional**
 * (contrato de subárbol §4): `WorkspacePage` propaga el estado de resolución del
 * `directory` (`useSessionDirectory`) para que la estructura distinga "aún
 * resolviendo" (esqueleto acotado) de "no resuelto / sesión inexistente"
 * (`notFound`), sin dejar un esqueleto terminal. Omitirlo mantiene el
 * comportamiento previo (con `directory` nulo se asume carga en curso).
 */
export const useGraphModel = (
  sessionId: string | null,
  directory: string | null,
  directoryResolution?: TDirectoryResolution,
): UseGraphModelResult => {
  const structure = useGraphStructure(sessionId, directory, directoryResolution);

  // Umbral de anomalía de latencia (FR-022): preferencia compartida con el
  // detalle; al cambiar, el enriquecimiento recalcula `context.latency`.
  const { threshold } = useAnomalyThreshold();

  // Ids del subárbol estructural: la fase de enriquecimiento los consume junto
  // con la topología (`structure.graph`) para planificar la carga por lotes.
  const ids = useMemo(
    () => structure.graph.nodes.map((node) => node.id),
    [structure.graph.nodes],
  );

  const enriched = useGraphEnrichment(ids, structure.graph, threshold);

  // Lotes por **invocación** del padre (T039): la unidad de paralelismo (FR-007).
  // Se derivan de las mismas claves de mensajes que carga el enriquecimiento
  // (sin consultas nuevas) y son la **fuente única** de filas y badge: el plan y
  // el paralelismo se derivan juntos en `deriveExecutionLayout(enriched, now,
  // batches)`, de modo que la paridad fila ↔ badge es estructural (FR-008).
  const batches = useInvocationBatches(structure.graph);

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
  // depende del reloj, solo de la topología, de la clase/borde de intervalo de
  // cada nodo (FR-008, Principio V) y de la **firma de lotes** (R8): al llegar
  // los mensajes del padre cambian los lotes y el plan se recalcula.
  const executionKey = deriveExecutionKey(enriched, batches);

  // Plan/paralelismo **autoritativo**: derivado de `enriched` (estados finales,
  // incluidos `compacting`/esperas) con los lotes por invocación y la única
  // lógica pura compartida (`deriveExecutionLayout`): niveles/tandas, posiciones
  // por carril/columna y badge `parallel` de la misma fuente de lotes (FR-010,
  // contract §5).
  const layout = useMemo(
    () => {
      // eslint-disable-next-line react-hooks/refs -- lectura puntual del reloj vivo al derivar
      const nowAtDerive = nowRef.current;
      return deriveExecutionLayout(enriched, nowAtDerive, batches);
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

  // Mapa de nodos vigente recordado tras cada commit (patrón "latest ref" del
  // repo): permite reutilizar la identidad del nodo —y con ella su `effort`—
  // cuando ni la duración ni el esfuerzo cambiaron (SC-006, Principio VII).
  const previousNodesRef = useRef<Map<string, TGraphNode>>(new Map());

  // El tick de 1 s refresca `durationMs` de los activos **y deriva el esfuerzo**
  // sobre ese mismo modelo (R3/R4): `deriveEffortByNode` recibe todos los nodos
  // con la duración ya actualizada —nunca `positioned`—. El esfuerzo no entra en
  // `enriched` ni en `deriveExecutionKey`, así que no dispara re-layout.
  const graph = useMemo<TGraphModel>(() => {
    // 1) Duración viva de los nodos activos (paso existente): la base de
    //    métricas es independiente del reloj y ya la resolvió el enriquecimiento.
    const tickedNodes = positioned.nodes.map((node) => {
      const { metrics } = node.data;
      if (metrics.startedAt === null) return node;
      const durationMs = (metrics.endedAt ?? now) - metrics.startedAt;
      if (durationMs === metrics.durationMs) return node;
      return {
        ...node,
        data: { ...node.data, metrics: { ...metrics, durationMs } },
      };
    });

    // 2) Esfuerzo por nodo sobre el modelo con la duración ya actualizada.
    const effortByNode = deriveEffortByNode(
      { nodes: tickedNodes, edges: positioned.edges },
      layout.plan,
      layout.parallelGroups,
    );

    // 2b) Aceleración por nodo (FR-009): solo los nodos que participan de un
    //     grupo paralelo de 2+ agentes reciben entrada; se lee el reloj vivo para
    //     los grupos aún provisionales, igual que el esfuerzo.
    const speedupByNode = deriveSpeedupByNode(
      { nodes: tickedNodes, edges: positioned.edges },
      layout.parallelGroups,
      now,
    );

    // 3) Se adjunta `effort` y `speedup` conservando el objeto de nodo anterior
    //    cuando `durationMs`, `effort` y `speedup` (y el resto de datos) no
    //    cambiaron; solo se reconstruye el nodo que realmente cambió (identidad
    //    estable, SC-006).
    const previousById = previousNodesRef.current;
    // eslint-disable-next-line react-hooks/refs -- lectura puntual del mapa vigente al derivar
    const nodes = tickedNodes.map((node) => {
      const effort = effortByNode[node.id] ?? null;
      const speedup = speedupByNode[node.id] ?? null;
      const previous = previousById.get(node.id);
      const next = { ...node, data: { ...node.data, effort, speedup } };
      if (previous !== undefined && sameNode(previous, next)) {
        return previous;
      }
      return next;
    });

    return { nodes, edges: positioned.edges };
  }, [positioned, now, layout]);

  // El mapa vigente se recuerda tras cada commit (no durante el render), como el
  // resto de "latest refs" del repo.
  useEffect(() => {
    previousNodesRef.current = new Map(
      graph.nodes.map((node) => [node.id, node]),
    );
  });

  // El nodo activo es el primero con un estado de ejecución en curso
  // (running/retrying/compacting/esperas), no solo `running` (FR-017). Se
  // resuelve sobre el modelo final para que los estados que solo son
  // definitivos tras el enriquecimiento (compacting/esperas) cuenten.
  const activeNodeId = useMemo(
    () =>
      graph.nodes.find((node) => isActiveStatus(node.data.status))?.id ?? null,
    [graph],
  );

  // Activo **más reciente** (FR-005): entre los activos, el de mayor hora de
  // inicio de ejecución (`activityStartOf`, desempate determinista por id). Es
  // aditivo y no sustituye a `activeNodeId`; `useFollowMode` lo consume para
  // centrar el viewport en el agente que empezó más tarde.
  const latestActiveId = useMemo(() => latestActiveNodeId(graph), [graph]);

  return {
    graph,
    parallelGroups: layout.parallelGroups,
    executionPlan: layout.plan,
    activeNodeId,
    latestActiveNodeId: latestActiveId,
    // Mientras el directorio del proyecto se resuelve no podemos cargar el
    // subárbol: el esqueleto sigue gobernado por la estructura (no por el
    // enriquecimiento) y es acotado (contrato de subárbol §4, FR-004/SC-002).
    isLoading: structure.isLoading,
    isError: structure.isError,
    error: structure.error,
    // La sesión inexistente la decide el cargador del subárbol **y** la
    // resolución del `directory` (FR-005); es aditivo y la estructura ya lo
    // expone resuelto (`false` si la sesión existe y no hay nodos aún).
    notFound: structure.notFound,
    // El corte por presupuesto global también nace en el cargador (FR-006); es
    // aditivo y la estructura ya lo expone resuelto (`false` si completo).
    truncated: structure.truncated,
  };
};
