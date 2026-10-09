import {
  Button,
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import {
  AgentGraph,
  GraphSkeleton,
  SessionSummaryBar,
  type UseGraphModelResult,
} from '@app/Domains/Graph';
import type { TSessionSummary } from '@app/Domains/Inspector';

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
}

/**
 * Panel del grafo: cabecera (contador de agentes + resumen + botón seguir) y
 * cuerpo con el orden de estados obligatorio **error → carga → vacío → datos**
 * (FR-008, Principio VI).
 *
 * Los componentes de presentación se importan por el **barrel** de dominio para
 * que los `vi.mock('@app/Domains/Graph')` de los specs sigan interceptándolos
 * (no montar React Flow real en los tests).
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
}: GraphPaneProps) => (
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
    <Container block className="min-h-0 flex-1">
      {graph.isError ? (
        <EmptyScreenError message={graph.error?.message} />
      ) : graph.isLoading ? (
        <GraphSkeleton />
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
        />
      )}
    </Container>
  </Container>
);
