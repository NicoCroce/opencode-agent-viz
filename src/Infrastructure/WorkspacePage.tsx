import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  CompactionContext,
  Container,
  EmptyScreenError,
  EmptyState,
} from '@app/Application/Components';
import {
  useDevice,
  useEscapeKey,
  useReasoningVisibility,
} from '@app/Application/Hooks';
import {
  PERF_METRIC,
  perfMark,
  perfMeasure,
  type TPerfMetricName,
} from '@app/Application/Helpers';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  SessionList,
  SessionListSkeleton,
  sessionDetailPath,
  useGetSessionStatus,
  useRootSessions,
} from '@app/Domains/Sessions';
import {
  InspectorPanel,
  useSessionContext,
  useSessionForms,
  type TResourceUsage,
} from '@app/Domains/Inspector';
import {
  AgentGraph,
  GraphSkeleton,
  SessionSummaryBar,
  isActiveStatus,
  summarizeSession,
  useChainSelection,
  useFollowMode,
  useGraphModel,
  useNow,
} from '@app/Domains/Graph';
import {
  HistoryModal,
  useHistory,
  type TLineageNav,
} from '@app/Domains/History';

type TTab = 'sessions' | 'graph' | 'inspector';

/** Linaje vacío: el nodo no tiene padre ni hijos en el grafo. */
const EMPTY_LINEAGE: TLineageNav = { parentId: null, childrenIds: [] };

/**
 * Recursos de la sesión para el resumen (FR-024). El resumen de la cabecera del
 * grafo agrega contadores/coste/tokens/tiempo; el inventario de recursos se
 * muestra en el detalle del agente, así que aquí basta el marcador disponible.
 */
const EMPTY_RESOURCE_USAGE: TResourceUsage = {
  mcpServers: [],
  instructions: [],
  skills: [],
  tools: [],
  availability: 'available',
};

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

  // Instrumentación de apertura/revisita (FR-011, contrato de instrumentación
  // §4): al cambiar de sesión se decide la medida según si la **estructura** del
  // subárbol ya estaba en el caché de consultas (`graph.session.open` si no,
  // `graph.session.revisit` si sí). La medida se registra cuando el grafo tiene
  // nodos, es decir, cuando la estructura está disponible.
  const queryClient = useQueryClient();
  const pendingSessionPerf = useRef<TPerfMetricName | null>(null);

  useEffect(() => {
    if (!id || !directory) {
      pendingSessionPerf.current = null;
      return;
    }
    const cached =
      queryClient.getQueryData(queryKeys.sessions.list(directory)) !== undefined;
    const metric = cached
      ? PERF_METRIC.sessionRevisit
      : PERF_METRIC.sessionOpen;
    pendingSessionPerf.current = metric;
    perfMark(`${metric}.start`);
  }, [id, directory, queryClient]);

  useEffect(() => {
    const metric = pendingSessionPerf.current;
    if (!metric || graph.isLoading || graph.isError) return;
    if (graph.graph.nodes.length === 0) return;
    perfMeasure(metric, `${metric}.start`, {
      nodeCount: graph.graph.nodes.length,
      phase: metric === PERF_METRIC.sessionOpen ? 'structure' : 'cache',
    });
    pendingSessionPerf.current = null;
  }, [graph.isLoading, graph.isError, graph.graph.nodes]);

  // Resumen agregado de la sesión (FR-024..FR-027) sobre los nodos ya cargados
  // en el grafo. `now` avanza en vivo para que el tiempo transcurrido se
  // actualice en el sitio sin relayoutar el grafo (FR-027).
  //
  // El tick solo se activa si hay al menos un nodo en curso (`isActiveStatus`),
  // igual que el reloj del modelo (FR-006, SC-005, R3): sin actividad, `now` no
  // altera ningún dato del resumen, así que no hay `setInterval` ni re-renders
  // innecesarios (Principio VII).
  const hasActiveNode = useMemo(
    () => graph.graph.nodes.some((node) => isActiveStatus(node.data.status)),
    [graph.graph.nodes],
  );
  const now = useNow(1000, Boolean(id) && hasActiveNode);
  const summary = useMemo(() => {
    const rootSession =
      items.find((item) => item.session.id === id)?.session ?? null;
    return rootSession
      ? summarizeSession(rootSession, graph.graph, EMPTY_RESOURCE_USAGE, now)
      : null;
  }, [items, id, graph.graph, now]);

  const rootId = id ?? null;
  const { selectedNodeId, inspectedNodeId, selectNode, clearSelection } =
    useChainSelection(rootId);

  // Overlay del histórico (FR-008/012/014) y visibilidad del razonamiento
  // compartida entre el inspector y el overlay (FR-002).
  const { targetId, open, close, navigateTo } = useHistory();
  const reasoning = useReasoningVisibility();

  // Sesión raíz actual del histórico y objetivo ausente (edge case). Ambos se
  // ajustan durante el render, siguiendo el patrón de `useChainSelection`, para
  // evitar renders en cascada.
  const [historyRootId, setHistoryRootId] = useState(rootId);
  const [missingHistoryId, setMissingHistoryId] = useState<string | null>(null);

  // Al cambiar la sesión raíz se cierra el histórico (FR-014).
  if (historyRootId !== rootId) {
    setHistoryRootId(rootId);
    setMissingHistoryId(null);
    close();
  }

  useEscapeKey(clearSelection, selectedNodeId !== null);

  const inspectedNode =
    graph.graph.nodes.find((node) => node.id === inspectedNodeId) ?? null;

  const openInspectedHistory = useCallback(() => {
    if (!inspectedNode) return;
    open(inspectedNode.data.sessionId);
  }, [inspectedNode, open]);

  // Nodo y linaje (padre/hijos desde las aristas) del histórico abierto.
  const historyNode = useMemo(
    () =>
      targetId
        ? graph.graph.nodes.find((node) => node.id === targetId) ?? null
        : null,
    [graph.graph.nodes, targetId],
  );

  const historyLineage = useMemo<TLineageNav>(() => {
    if (!targetId) return EMPTY_LINEAGE;
    const parentEdge = graph.graph.edges.find((edge) => edge.target === targetId);
    const childrenIds = graph.graph.edges
      .filter((edge) => edge.source === targetId)
      .map((edge) => edge.target);
    return { parentId: parentEdge?.source ?? null, childrenIds };
  }, [graph.graph.edges, targetId]);

  // Preguntas (FR-033) y contexto de compactación (FR-035) del histórico: los
  // formularios los posee el dominio Inspector, así que Infrastructure pide los
  // datos con sus hooks y los inyecta en el overlay por props (Constitución II).
  const historySessionId = historyNode?.data.sessionId ?? null;
  const historyForms = useSessionForms(historySessionId);
  const historyContext = useSessionContext(historySessionId);

  // El objetivo desapareció del grafo (edge case): se marca "no disponible" y
  // se cierra el overlay. Se espera a que el grafo resuelva para no marcar
  // mientras carga.
  const historyMissing =
    targetId !== null &&
    !historyNode &&
    !graph.isLoading &&
    !graph.isError;

  if (historyMissing && missingHistoryId !== targetId) {
    setMissingHistoryId(targetId);
    close();
  }

  // Agentes que corrieron en paralelo con el nodo inspeccionado. Se calcula
  // sobre el grafo completo (no sobre la proyección de cadena).
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

  // Relación padre → hijo: quién invocó al nodo inspeccionado.
  const inspectedParent = useMemo(() => {
    if (!inspectedNodeId) return null;
    const edge = graph.graph.edges.find(
      (candidate) => candidate.target === inspectedNodeId,
    );
    if (!edge) return null;
    return graph.graph.nodes.find((node) => node.id === edge.source) ?? null;
  }, [graph.graph.edges, graph.graph.nodes, inspectedNodeId]);

  // Overlay del histórico: el modal cuando el objetivo está en el grafo, o un
  // estado "no disponible" cuando el objetivo desapareció (edge case).
  const historyOverlay = historyNode ? (
    <HistoryModal
      node={historyNode}
      lineage={historyLineage}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onNavigate={navigateTo}
      onClose={close}
      questions={historyForms.questions}
      renderCompactionContext={() => (
        <CompactionContext
          messages={historyContext.messages}
          isError={historyContext.isError}
          isLoading={historyContext.isLoading}
        />
      )}
    />
  ) : missingHistoryId ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico no disponible"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-1 p-4"
    >
      <EmptyState
        title="Histórico no disponible"
        description="El agente ya no está en el grafo."
        action={{
          label: 'Cerrar',
          onClick: () => setMissingHistoryId(null),
          variant: 'outline',
        }}
      />
    </div>
  ) : null;

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
            onSelectNode={selectNode}
            onClearSelection={clearSelection}
            onOpenHistory={open}
            followNodeId={follow.followNodeId}
            resetKey={rootId}
          />
        )}
      </Container>
    </Container>
  );

  const inspectorPane = (
    <InspectorPanel
      node={inspectedNode}
      parallelPeers={inspectedPeers}
      invokedBy={inspectedParent}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onOpenHistory={openInspectedHistory}
    />
  );

  if (isMobile) {
    return (
      <>
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
        {historyOverlay}
      </>
    );
  }

  return (
    <>
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
      {historyOverlay}
    </>
  );
};
