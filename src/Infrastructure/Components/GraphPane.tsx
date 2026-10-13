import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import { GraphTruncationBanner } from '@app/Application/Components/Molecules';
import {
  AgentGraph,
  GraphSkeleton,
  SessionSummaryBar,
  type UseGraphModelResult,
} from '@app/Domains/Graph';
import { queryKeys } from '@app/Domains/queryKeys';
import { SESSIONS_LIST_ROUTE } from '@app/Domains/Sessions';
import type { TSessionSummary } from '@app/Domains/Inspector';

/**
 * Forma mínima del resultado cacheado de raíces (`sessions.roots`) que necesita
 * el panel: solo el corte del **listado** de su directorio (FR-006).
 */
interface TCachedRootsTruncation {
  truncated?: boolean;
}

/** Modo "seguir nodo activo" del grafo (forma de `useFollowMode`). */
export interface TFollowMode {
  enabled: boolean;
  toggle: () => void;
  followNodeId: string | null;
}

interface GraphPaneProps {
  graph: UseGraphModelResult;
  summary: TSessionSummary | null;
  follow: TFollowMode;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onClearSelection: () => void;
  onOpenHistory: (sessionId: string) => void;
  rootId: string | null;
  /**
   * Ids de nodos con un pendiente de atención (FR-009); se reenvía a
   * `AgentGraph` para el realce por contexto, sin tocar `data` ni re-layoutar.
   */
  attentionNodeIds?: ReadonlySet<string>;
}

/**
 * Panel del grafo: cabecera (contador de agentes + resumen + botón seguir) y
 * cuerpo con el orden de estados obligatorio **error → carga → no encontrada →
 * vacío → datos** (FR-004/FR-005/FR-008, Principio VI).
 *
 * "No encontrada" (sesión inexistente) es un estado propio, **distinto** de
 * "sin agentes" y del error, y siempre ofrece salida al listado de sesiones: la
 * carga acotada tiene prioridad sobre él y ningún estado queda sin salida
 * (SC-002, contrato de subárbol §4).
 *
 * Los componentes de presentación se importan por el **barrel** de dominio para
 * que los `vi.mock('@app/Domains/Graph')` de los specs sigan interceptándolos
 * (no montar React Flow real en los tests).
 *
 * El aviso de truncamiento (FR-006) se monta **entre la cabecera y el lienzo**,
 * de forma persistente y sin bloquear el grafo: no hay estado que lo oculte ni
 * acción dentro de él (informativo puro, `role="status"`). Se acota al
 * **directorio de la sesión que se está viendo**: el del subárbol (`graph.truncated`)
 * o el de su listado de raíces leído de la caché (`sessions.roots(directory)`),
 * nunca el agregado de todos los proyectos (review 1, amarillo 4).
 */
export const GraphPane = ({
  graph,
  summary,
  follow,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  onOpenHistory,
  rootId,
  attentionNodeIds,
}: GraphPaneProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Directorio de la sesión que se está viendo: todos los nodos del subárbol
  // pertenecen al mismo proyecto, así que basta el nodo abierto
  // (`data.sessionId === rootId`) y, como respaldo, el primer nodo. Sin nodos
  // (p. ej. sesión inexistente) el directorio es indeterminable y el aviso no se
  // muestra: no hay un corte propio que declarar.
  const viewedDirectory =
    graph.graph.nodes.find((node) => node.data.sessionId === rootId)?.data
      .directory ??
    graph.graph.nodes[0]?.data.directory ??
    null;

  // El corte del **listado de raíces** se lee de la caché por el directorio
  // abierto (`sessions.roots(directory)`, ya poblada por el cargador del
  // subárbol): usar el agregado de `useRootSessions` marcaba "vista parcial" al
  // abrir un proyecto completo si **otro** proyecto se había cortado (review 1,
  // amarillo 4). No abre ninguna consulta nueva.
  const rootsTruncated =
    viewedDirectory === null
      ? false
      : (queryClient.getQueryData<TCachedRootsTruncation>(
          queryKeys.sessions.roots(viewedDirectory),
        )?.truncated ?? false);

  // El corte del subárbol (`graph.truncated`) ya está acotado por construcción a
  // la sesión abierta; se suma el del listado de su propio directorio.
  const isTruncated = graph.truncated || rootsTruncated;

  return (
    <Container space="none" className="h-full min-h-0 min-w-0">
      <Container
        row
        space="small"
        justify="between"
        align="center"
        className="min-w-0 shrink-0 border-b border-border px-3 py-2"
      >
        <Container row space="small" align="center" className="min-w-0">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {graph.graph.nodes.length} agentes
          </span>
          {summary ? <SessionSummaryBar summary={summary} /> : null}
        </Container>
        <Button
          variant="outline"
          onClick={follow.toggle}
          aria-pressed={follow.enabled}
        >
          {follow.enabled ? 'Siguiendo' : 'Seguir'}
        </Button>
      </Container>
      {isTruncated ? (
        <GraphTruncationBanner className="shrink-0 rounded-none border-x-0 border-t-0" />
      ) : null}
      <Container block className="min-h-0 min-w-0 flex-1">
        {/*
          Orden de estados del contrato de subárbol §4, sin excepción:
          error → carga acotada → no encontrada → vacío → datos. "No encontrada"
          (sesión inexistente / 404) ofrece salida al listado; el fallo real de
          datos se queda en `EmptyScreenError` (no se colapsa con "no
          encontrada" ni con "sin agentes"). La carga es **acotada**: el estado
          que la gobierna (`isLoading`) solo lo marca la resolución del
          `directory` o la estructura, nunca un esqueleto terminal (FR-004/
          FR-005, SC-002).
        */}
        {graph.isError ? (
          <EmptyScreenError message={graph.error?.message} />
        ) : graph.isLoading ? (
          <GraphSkeleton />
        ) : graph.notFound ? (
          <EmptyState
            title="Sesión no encontrada"
            description="Esta sesión no existe o ya no está disponible en este proyecto."
            action={{
              label: 'Ir al listado de sesiones',
              onClick: () => {
                void navigate(SESSIONS_LIST_ROUTE);
              },
            }}
          />
        ) : graph.graph.nodes.length === 0 ? (
          <EmptyState
            title="Sin agentes"
            description="Esta sesión todavía no reportó agentes."
          />
        ) : (
          <AgentGraph
            graph={graph.graph}
            plan={graph.executionPlan}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onClearSelection={onClearSelection}
            onOpenHistory={onOpenHistory}
            followNodeId={follow.followNodeId}
            resetKey={rootId}
            attentionNodeIds={attentionNodeIds}
          />
        )}
      </Container>
    </Container>
  );
};
