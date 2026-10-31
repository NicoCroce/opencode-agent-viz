import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChartLine } from 'lucide-react';
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

interface TCachedRootsTruncation {
  truncated?: boolean;
}

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
  attentionNodeIds?: ReadonlySet<string>;
  onOpenEfficiency?: (trigger: HTMLElement) => void;
  isMobile?: boolean;
}

/**
 * Panel del grafo: cabecera instrumental (contador + resumen + acciones) y
 * cuerpo con el orden de estados obligatorio **error → carga → no encontrada →
 * vacío → datos** (FR-004/FR-005/FR-008, Principio VI).
 *
 * La cabecera deja de competir con el lienzo: el contador de agentes es la
 * cifra protagonista, el resumen son pares etiqueta/valor y las acciones viven
 * a la derecha en una única fila.
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
  onOpenEfficiency,
  isMobile = false,
}: GraphPaneProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const viewedDirectory =
    graph.graph.nodes.find((node) => node.data.sessionId === rootId)?.data
      .directory ??
    graph.graph.nodes[0]?.data.directory ??
    null;

  const rootsTruncated =
    viewedDirectory === null
      ? false
      : (queryClient.getQueryData<TCachedRootsTruncation>(
          queryKeys.sessions.roots(viewedDirectory),
        )?.truncated ?? false);

  const isTruncated = graph.truncated || rootsTruncated;
  const agentCount = graph.graph.nodes.length;

  return (
    <Container space="none" className="h-full min-h-0 min-w-0">
      <Container
        row
        space="none"
        justify="between"
        align="center"
        className="shrink-0 gap-3 border-b border-border/60 bg-surface-0/40 px-4 py-2"
      >
        <Container row space="small" align="center" className="min-w-0">
          <span
            role="group"
            className="flex shrink-0 items-baseline gap-1.5"
            aria-label={`${agentCount} ${agentCount === 1 ? 'agente' : 'agentes'}`}
          >
            <span className="font-display text-lg font-semibold leading-none tabular-nums text-foreground">
              {agentCount}
            </span>
            <span className="text-[9px] font-medium uppercase leading-none tracking-[0.16em] text-muted-foreground">
              {agentCount === 1 ? 'agente' : 'agentes'}
            </span>
          </span>
          {summary ? (
            <>
              <span aria-hidden className="h-4 w-px shrink-0 bg-border/60" />
              <SessionSummaryBar
                summary={summary}
                compact={isMobile}
                metricsClassName="hidden 2xl:flex"
              />
            </>
          ) : null}
        </Container>
        <Container row space="small" align="center" className="shrink-0">
          {agentCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              icon={ChartLine}
              showIcon
              aria-haspopup="dialog"
              aria-label={isMobile ? 'Abrir análisis de eficiencia' : undefined}
              onClick={(event) => onOpenEfficiency?.(event.currentTarget)}
            >
              {isMobile ? null : 'Eficiencia'}
            </Button>
          ) : null}
          <Button
            variant={follow.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={follow.toggle}
            aria-pressed={follow.enabled}
          >
            {follow.enabled ? 'Siguiendo' : 'Seguir'}
          </Button>
        </Container>
      </Container>
      {isTruncated ? (
        <GraphTruncationBanner className="shrink-0 rounded-none border-x-0 border-t-0" />
      ) : null}
      <Container block className="min-h-0 min-w-0 flex-1">
        {graph.isError ? (
          <Container align="center" justify="center" className="h-full p-6">
            <EmptyScreenError message={graph.error?.message} />
          </Container>
        ) : graph.isLoading ? (
          <GraphSkeleton />
        ) : graph.notFound ? (
          <Container align="center" justify="center" className="h-full p-6">
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
          </Container>
        ) : agentCount === 0 ? (
          <Container align="center" justify="center" className="h-full p-6">
            <EmptyState
              title="Sin agentes"
              description="Esta sesión todavía no reportó agentes."
            />
          </Container>
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
