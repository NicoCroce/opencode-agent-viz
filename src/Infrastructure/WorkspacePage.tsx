import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import { useDevice, useEscapeKey } from '@app/Application/Hooks';
import {
  SessionList,
  SessionListSkeleton,
  sessionDetailPath,
  useGetSessionStatus,
  useRootSessions,
} from '@app/Domains/Sessions';
import { InspectorPanel } from '@app/Domains/Inspector';
import {
  AgentGraph,
  buildChain,
  GraphSkeleton,
  layoutChain,
  useChainSelection,
  useFollowMode,
  useGraphModel,
} from '@app/Domains/Graph';

type TTab = 'sessions' | 'graph' | 'inspector';

export const WorkspacePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [tab, setTab] = useState<TTab>('graph');

  const { groups, items, isLoading: sessionsLoading } = useRootSessions();
  const statusQuery = useGetSessionStatus();
  const directory = useMemo(
    () => items.find((item) => item.session.id === id)?.session.location.directory ?? null,
    [items, id],
  );
  const graph = useGraphModel(id ?? null, directory);
  const follow = useFollowMode(graph.activeNodeId);

  const rootId = id ?? null;
  const {
    selectedNodeId,
    inspectedNodeId,
    isChainMode,
    selectNode,
    clearSelection,
  } = useChainSelection(rootId);

  useEscapeKey(clearSelection, isChainMode);

  // Proyección de la vista: grafo completo o cadena raíz→nodo en una fila.
  // Si el nodo seleccionado ya no existe, `buildChain` devuelve `null` y se
  // conserva el grafo completo (sin estado vacío inconsistente).
  const displayGraph = useMemo(() => {
    if (!isChainMode || !selectedNodeId) return graph.graph;
    const chain = buildChain(graph.graph, selectedNodeId);
    return chain ? layoutChain(chain) : graph.graph;
  }, [isChainMode, selectedNodeId, graph.graph]);

  const inspectedNode =
    graph.graph.nodes.find((node) => node.id === inspectedNodeId) ?? null;

  // Agentes que corrieron en paralelo con el nodo inspeccionado.
  const inspectedPeers = useMemo(() => {
    if (!inspectedNodeId) return [];
    const group = graph.parallelGroups.find((candidate) =>
      candidate.nodeIds.includes(inspectedNodeId),
    );
    if (!group) return [];
    return group.nodeIds
      .filter((nodeId) => nodeId !== inspectedNodeId)
      .map((nodeId) => graph.graph.nodes.find((node) => node.id === nodeId))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [graph.parallelGroups, graph.graph.nodes, inspectedNodeId]);

  const rail = (
    <Container space="small" className="p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sesiones
      </span>
      {sessionsLoading ? (
        <SessionListSkeleton />
      ) : (
        <SessionList
          groups={groups}
          statuses={statusQuery.data}
          selectedId={id ?? null}
          onSelect={(sessionId) => {
            void navigate(sessionDetailPath(sessionId));
          }}
        />
      )}
    </Container>
  );

  const graphPane = (
    <Container space="none" className="h-full min-h-0">
      <Container
        row
        space="small"
        justify="between"
        align="center"
        className="shrink-0 border-b border-border px-3 py-2"
      >
        <span className="font-mono text-xs text-muted-foreground">
          {graph.graph.nodes.length} agentes
        </span>
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
            graph={displayGraph}
            selectedNodeId={selectedNodeId}
            isChainMode={isChainMode}
            onSelectNode={selectNode}
            onClearSelection={clearSelection}
            followNodeId={follow.followNodeId}
            resetKey={rootId}
          />
        )}
      </Container>
    </Container>
  );

  const inspectorPane = (
    <InspectorPanel node={inspectedNode} parallelPeers={inspectedPeers} />
  );

  if (isMobile) {
    return (
      <Container space="none" className="h-full min-h-0">
        <Container
          row
          space="none"
          className="shrink-0 border-b border-border"
          role="tablist"
        >
          {(['sessions', 'graph', 'inspector'] as TTab[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
                tab === item
                  ? 'border-b-2 border-accent text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {item}
            </button>
          ))}
        </Container>
        <Container block className="min-h-0 flex-1 overflow-auto">
          {tab === 'sessions' ? rail : null}
          {tab === 'graph' ? graphPane : null}
          {tab === 'inspector' ? inspectorPane : null}
        </Container>
      </Container>
    );
  }

  return (
    <Container row space="none" className="h-full min-h-0">
      <Container
        space="none"
        className="w-[280px] shrink-0 overflow-auto border-r border-border"
      >
        {rail}
      </Container>
      <Container block className="min-h-0 flex-1">
        {graphPane}
      </Container>
      <Container
        block
        className="w-[360px] shrink-0 overflow-auto border-l border-border"
      >
        {inspectorPane}
      </Container>
    </Container>
  );
};
