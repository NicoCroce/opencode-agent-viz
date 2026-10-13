import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionRequest } from '@opencode/client';
import { useDevice, useReasoningVisibility } from '@app/Application/Hooks';
import {
  useChainSelection,
  useFollowMode,
  useGraphModel,
} from '@app/Domains/Graph';
import {
  sessionDetailPath,
  useGetSessionStatus,
  useRootSessions,
  useSessionDirectory,
} from '@app/Domains/Sessions';
import { ChatPanel, type TAttentionItem } from '@app/Domains/Chat';
import { useSessionAttention } from '@app/Domains/Chat/Hooks/useSessionAttention';
import { useAttentionNotifications } from '@app/Domains/Chat/Hooks/useAttentionNotifications';
import { useHistory } from '@app/Domains/History';
import { queryKeys } from '@app/Domains/queryKeys';
import { GraphPane } from './Components/GraphPane';
import { HistoryOverlay } from './Components/HistoryOverlay';
import { InspectorPane } from './Components/InspectorPane';
import { SessionsRail } from './Components/SessionsRail';
import { WorkspaceView } from './Components/WorkspaceView';
import { useAttentionByRoot } from './Hooks/useAttentionByRoot';
import { useAttentionNodeIds } from './Hooks/useAttentionNodeIds';
import { useChatPending } from './Hooks/useChatPending';
import { useChatSelectionSeed } from './Hooks/useChatSelectionSeed';
import { CHAT_TAB_ID, useDetailTabs } from './Hooks/useDetailTabs';
import { useHistoryData } from './Hooks/useHistoryData';
import { useInspectorPanel } from './Hooks/useInspectorPanel';
import { useSessionOpenPerf } from './Hooks/useSessionOpenPerf';
import { useWorkspaceEscape } from './Hooks/useWorkspaceEscape';
import { useWorkspaceSummary } from './Hooks/useWorkspaceSummary';
import type { TWorkspaceTab } from './WorkspacePage.constants';

/**
 * Página del workspace: **solo composición**. El data-fetching cross-domain vive
 * aquí, en Infrastructure (Principio II), delegado en los hooks de `Hooks/` y
 * `lib/` (T008–T013); la página cablea los cinco slots y la vista (FR-005).
 */
export const WorkspacePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [tab, setTab] = useState<TWorkspaceTab>('graph');
  const panel = useInspectorPanel();

  const { groups, items, isLoading: sessionsLoading } = useRootSessions();
  const statusQuery = useGetSessionStatus();
  // El listado de raíces puede truncar y la sesión abierta puede no estar en
  // `items`: el `directory` se resuelve por la cadena `items` → `session.get` →
  // `null` (contrato `session-roots` §5/R3) y su estado de resolución se propaga
  // **entero** al modelo (contrato de subárbol §4), para distinguir "aún
  // resolviendo" de "no encontrada" (FR-003/FR-004/FR-005).
  const {
    directory,
    isLoading: directoryLoading,
    isError: directoryError,
    isNotFound: directoryNotFound,
  } = useSessionDirectory(id ?? null, items);
  const graph = useGraphModel(id ?? null, directory, {
    isLoading: directoryLoading,
    isError: directoryError,
    isNotFound: directoryNotFound,
  });
  // El modo "seguir" se ancla al nodo activo más reciente (FR-005).
  const follow = useFollowMode(graph.latestActiveNodeId);

  // Lectura reactiva de la caché reducida de permisos (dueño: el reducer de
  // eventos): el `queryFn` devuelve el valor cacheado, nunca vacía la lista
  // (FR-009/FR-011). Es la **única** suscripción de `permissions.list()`: se
  // pasa a `useChatPending`, que no abre observadores propios (evita el bucle
  // de renders por doble observador de la misma clave).
  const queryClient = useQueryClient();
  const permissionsQuery = useQuery({
    queryKey: queryKeys.permissions.list(),
    queryFn: () =>
      Promise.resolve(
        queryClient.getQueryData<PermissionRequest[]>(
          queryKeys.permissions.list(),
        ) ?? [],
      ),
    staleTime: Infinity,
    initialData: [] as PermissionRequest[],
  });
  const listedPermissions = permissionsQuery.data;

  // Atención de pendientes (FR-009/FR-010/FR-011): `useSessionAttention` es la
  // **única fuente** de las señales (badge, banner, toast, realce).
  const attention = useSessionAttention(id ?? null, graph.graph);
  const chatPending = useChatPending(attention, graph.graph.nodes, listedPermissions);

  useSessionOpenPerf({
    id: id ?? null,
    directory,
    isLoading: graph.isLoading,
    isError: graph.isError,
    nodeCount: graph.graph.nodes.length,
  });

  const { summary } = useWorkspaceSummary({
    items,
    id: id ?? null,
    graph: graph.graph,
  });

  const rootId = id ?? null;
  const { selectedNodeId, inspectedNodeId, selectNode, clearSelection } =
    useChainSelection(rootId);

  const attentionNodeIds = useAttentionNodeIds(attention);

  // Badge por raíz del rail (FR-009): primitivas derivadas y memoizadas por
  // separado para preservar la identidad de las dependencias del hook (FR-019).
  const rootIds = useMemo(() => items.map((item) => item.session.id), [items]);
  const openSubtreeSessionIds = useMemo(
    () => new Set(graph.graph.nodes.map((node) => node.data.sessionId)),
    [graph.graph.nodes],
  );
  const openQuestionCount = useMemo(
    () => attention.filter((item) => item.kind === 'question').length,
    [attention],
  );
  const attentionByRoot = useAttentionByRoot({
    rootIds,
    permissions: listedPermissions,
    openRootId: rootId,
    openSubtreeSessionIds,
    openQuestionCount,
  });

  // La pestaña del detalle (`Detalle | Chat`) se controla desde la página para
  // poder abrir el Chat al navegar a la request origen (FR-010).
  const { tab: detailTab, setTab: setDetailTab } = useDetailTabs();

  const handleGoToRequest = useCallback(
    (item: TAttentionItem) => {
      // Selecciona el nodo de origen (aunque sea una hija) para enfocar la
      // request; si el ítem no está en el subárbol, navega a su sesión.
      if (item.nodeId) {
        selectNode(item.nodeId);
      } else {
        void navigate(sessionDetailPath(item.sessionId));
      }
      setDetailTab(CHAT_TAB_ID);
      // Móvil (FR-013): el tablist `Detalle | Chat` no se monta, así que la
      // acción también cambia el tab de primer nivel del workspace (FR-010).
      if (isMobile) setTab('chat');
    },
    [selectNode, navigate, setDetailTab, isMobile],
  );

  // Aviso efímero accesible ante un pendiente nuevo (FR-009); deduplica por id.
  useAttentionNotifications(attention, handleGoToRequest);

  // Overlay del histórico (FR-008/012/014) y razonamiento compartido (FR-002).
  const { targetId, open, close, navigateTo } = useHistory();
  const reasoning = useReasoningVisibility();

  const historyData = useHistoryData({
    graph: graph.graph,
    targetId,
    rootId,
    isLoading: graph.isLoading,
    isError: graph.isError,
    onClose: close,
  });

  // `Escape` (chat-panel-contract §5): foco en chat → fullscreen → selección.
  useWorkspaceEscape({
    isFullscreen: panel.isFullscreen,
    closeFullscreen: panel.closeFullscreen,
    clearSelection,
    selectedNodeId,
  });

  // Semilla de la selección del chat derivada del **nodo abierto** (FR-008).
  const chatSelectionSeed = useChatSelectionSeed({
    nodes: graph.graph.nodes,
    sessionId: rootId,
  });

  // Panel de chat (FR-008): se hospeda en la pestaña `Chat` del detalle
  // (escritorio) y como tab de primer nivel en móvil (FR-013/FR-014). Sin sesión
  // no hay chat.
  const chatPane = id ? (
    <ChatPanel
      sessionId={id}
      directory={directory}
      selectionSeed={chatSelectionSeed}
      showReasoning={reasoning.visible}
      pending={chatPending}
      attention={attention}
      onGoToRequest={handleGoToRequest}
    />
  ) : null;

  const sessions = (
    <SessionsRail
      groups={groups}
      statuses={statusQuery.data}
      selectedId={id ?? null}
      isLoading={sessionsLoading}
      attentionByRoot={attentionByRoot}
      onSelect={(sessionId) => {
        void navigate(sessionDetailPath(sessionId));
      }}
    />
  );

  const graphPane = (
    <GraphPane
      graph={graph}
      summary={summary}
      follow={follow}
      selectedNodeId={selectedNodeId}
      onSelectNode={selectNode}
      onClearSelection={clearSelection}
      onOpenHistory={open}
      rootId={rootId}
      attentionNodeIds={attentionNodeIds}
    />
  );

  const inspectorPane = (
    <InspectorPane
      graph={graph.graph}
      parallelGroups={graph.parallelGroups}
      inspectedNodeId={inspectedNodeId}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onOpenHistory={open}
      onSelectNode={selectNode}
      isResizing={panel.isResizing}
      isFullscreen={panel.isFullscreen}
      onToggleFullscreen={panel.toggleFullscreen}
      chat={chatPane}
      showDetailTabs={!isMobile}
      attentionCount={attention.length}
      activeTab={detailTab}
      onTabChange={setDetailTab}
    />
  );

  const historyOverlay = (
    <HistoryOverlay
      node={historyData.node}
      lineage={historyData.lineage}
      missingId={historyData.missingId}
      onClearMissing={historyData.clearMissing}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onNavigate={navigateTo}
      onClose={close}
      questions={historyData.questions}
      context={historyData.context}
    />
  );

  return (
    <WorkspaceView
      sessions={sessions}
      graph={graphPane}
      inspector={inspectorPane}
      chat={chatPane}
      history={historyOverlay}
      panel={panel}
      attentionCount={attention.length}
      isMobile={Boolean(isMobile)}
      tab={tab}
      onChangeTab={setTab}
    />
  );
};
