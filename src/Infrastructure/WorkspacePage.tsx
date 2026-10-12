import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FormDetail,
  FormInfo,
  PermissionRequest,
} from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { useDevice, useEscapeKey, useReasoningVisibility } from '@app/Application/Hooks';
import {
  useChainSelection,
  useFollowMode,
  useGraphModel,
} from '@app/Domains/Graph';
import {
  sessionDetailPath,
  useGetSessionStatus,
  useRootSessions,
} from '@app/Domains/Sessions';
import { useSessionContext, useSessionForms } from '@app/Domains/Inspector';
import {
  ChatPanel,
  type TAttentionItem,
  type TChatPendingItem,
  type TChatSelectionSeed,
} from '@app/Domains/Chat';
import { useSessionAttention } from '@app/Domains/Chat/Hooks/useSessionAttention';
import { useAttentionNotifications } from '@app/Domains/Chat/Hooks/useAttentionNotifications';
import { useHistory } from '@app/Domains/History';
import { queryKeys } from '@app/Domains/queryKeys';
import { GraphPane } from './Components/GraphPane';
import { HistoryOverlay } from './Components/HistoryOverlay';
import { InspectorPane } from './Components/InspectorPane';
import { SessionsRail } from './Components/SessionsRail';
import { WorkspaceChatAttentionContext } from './Components/WorkspaceMobileTabs';
import { WorkspaceLayout } from './Components/WorkspaceLayout';
import { CHAT_TAB_ID, useDetailTabs } from './Hooks/useDetailTabs';
import { useHistoryOverlay } from './Hooks/useHistoryOverlay';
import { useInspectorPanel } from './Hooks/useInspectorPanel';
import { useSessionOpenPerf } from './Hooks/useSessionOpenPerf';
import { useWorkspaceSummary } from './Hooks/useWorkspaceSummary';
import type { TWorkspaceTab } from './WorkspacePage.constants';

/**
 * Selector del contenedor del panel de chat (`ChatPanel` marca su raíz con
 * `data-testid="chat-panel"`). Se usa para decidir si un `Escape` pertenece al
 * composer (chat-panel-contract §5).
 */
const CHAT_PANEL_SELECTOR = '[data-testid="chat-panel"]';

/**
 * `true` cuando el foco está dentro del panel de chat: el `Escape` pertenece al
 * composer (que cancela solo su estado inline) y **no** debe propagarse al
 * handler de la página —ni cerrar el fullscreen ni limpiar la selección—
 * (chat-panel-contract §5). El listener global vive en `window`, así que se
 * inspecciona `document.activeElement` en el momento del `keydown`.
 */
const isFocusWithinChat = (): boolean => {
  const active = document.activeElement;
  return active !== null && active.closest(CHAT_PANEL_SELECTOR) !== null;
};

/**
 * Conteo de atención por sesión raíz para el rail (T073, FR-009/US5).
 *
 * `useSessionAttention` solo cubre el **subárbol abierto**; el rail necesita un
 * badge por **cada** raíz. Se cuentan los permisos abiertos de
 * `permissions.list()` que pertenecen al subárbol de cada raíz (el del grafo
 * abierto es el único árbol completo que conocemos; para el resto basta la
 * propia sesión) y se añaden las **preguntas** del subárbol abierto, que solo
 * `useSessionAttention` puede derivar. Función **pura**: no muta las entradas ni
 * duplica la derivación de `deriveAttention`.
 */
export const countAttentionByRoot = (
  roots: string[],
  permissions: PermissionRequest[],
  openRootId: string | null,
  openSubtreeSessionIds: ReadonlySet<string>,
  openQuestionCount: number,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const rootId of roots) {
    const sessionIds =
      rootId === openRootId
        ? new Set([...openSubtreeSessionIds, rootId])
        : new Set([rootId]);
    counts[rootId] = permissions.filter((permission) =>
      sessionIds.has(permission.sessionID),
    ).length;
  }
  if (openRootId !== null && counts[openRootId] !== undefined) {
    counts[openRootId] += openQuestionCount;
  }
  return counts;
};

/**
 * Proyección `FormInfo` → `TQuestionEntry` para las preguntas del **subárbol**
 * que compone la bandeja (T074, FR-007). La pregunta se trata como pendiente por
 * construcción: la única fuente `useSessionAttention` solo produce ítems de
 * pregunta para nodos en `waiting-input`, así que `state` es `'pending'` y no hay
 * respuesta. Los campos/opciones se derivan con la misma regla que
 * `toQuestionEntry` del Inspector, sin importar su `lib` interna (Principio II:
 * nada de deep-imports entre dominios).
 */
const toPendingQuestionEntry = (form: FormInfo): TQuestionEntry => ({
  id: form.id,
  title: form.title,
  fields: form.fields.map((field) => ({
    key: field.key,
    title: field.title ?? null,
    type: field.type,
    options:
      field.type === 'string' || field.type === 'multiselect'
        ? (field.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))
        : [],
  })),
  state: 'pending',
  answer: null,
});

export const WorkspacePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [tab, setTab] = useState<TWorkspaceTab>('graph');
  // Estado de vista del panel de detalle (US5/US6): ancho persistido y
  // fullscreen efímero. Una sola fuente de lógica para ambas presentaciones.
  const panel = useInspectorPanel();

  const { groups, items, isLoading: sessionsLoading } = useRootSessions();
  const statusQuery = useGetSessionStatus();
  const directory = useMemo(
    () =>
      items.find((item) => item.session.id === id)?.session.location.directory ??
      null,
    [items, id],
  );
  const graph = useGraphModel(id ?? null, directory);
  // El modo "seguir" se ancla al nodo activo más reciente (FR-005), no al
  // primero en orden de nodo; `activeNodeId` se conserva para otros usos.
  const follow = useFollowMode(graph.latestActiveNodeId);

  // Bandeja de pendientes del chat (T037/US3): el **data-fetching cross-domain**
  // vive aquí, en Infrastructure (Principio II). Los pendientes de permiso se
  // leen de la caché global reducida `permissions.list()` (incluye hijas porque
  // `permission.asked` trae su `sessionID`, FR-007) y, como respaldo en frío, de
  // `permissions.for(id)` que siembra el enriquecimiento del grafo; las
  // preguntas abiertas de la sesión abierta vienen de `useSessionForms`.
  const queryClient = useQueryClient();
  const permissionsQuery = useQuery({
    queryKey: queryKeys.permissions.list(),
    // Lector reactivo de una clave cuyo dueño es el reducer de eventos: el
    // `queryFn` devuelve el valor cacheado, nunca vacía la lista (FR-009/FR-011).
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

  // Atención de pendientes (T053/T055, FR-009/FR-010/FR-011): `useSessionAttention`
  // es la **única fuente** de las señales (badge, banner, toast, realce) y, por
  // tanto, de qué sesiones del subárbol (raíz o hijas) tienen una pregunta
  // pendiente. El data-fetching cross-domain vive aquí, en Infrastructure
  // (Principio II). Se declara antes de la bandeja para que esta derive de ella
  // las preguntas accionables del subárbol (T074).
  const attention = useSessionAttention(id ?? null, graph.graph);

  const chatPending = useMemo<TChatPendingItem[]>(() => {
    const nodes = graph.graph.nodes;
    const subtreeIds = new Set(nodes.map((node) => node.data.sessionId));
    const labelFor = (sessionId: string): string =>
      nodes.find((node) => node.data.sessionId === sessionId)?.data.agentName ??
      sessionId;

    const items: TChatPendingItem[] = [];
    const seen = new Set<string>();

    const addPermission = (permission: PermissionRequest) => {
      if (!subtreeIds.has(permission.sessionID) || seen.has(permission.id)) {
        return;
      }
      seen.add(permission.id);
      items.push({
        kind: 'permission',
        originSessionId: permission.sessionID,
        originLabel: labelFor(permission.sessionID),
        permission: {
          id: permission.id,
          action: permission.action,
          resources: permission.resources,
          message: permission.message ?? null,
        },
      });
    };

    for (const permission of listedPermissions) addPermission(permission);
    for (const sessionId of subtreeIds) {
      const seeded =
        queryClient.getQueryData<PermissionRequest[]>(
          queryKeys.permissions.for(sessionId),
        ) ?? [];
      for (const permission of seeded) addPermission(permission);
    }

    // Preguntas accionables del subárbol (T074, FR-007): `attention` ya acota el
    // subárbol y marca las sesiones en `waiting-input`; los campos se leen de la
    // caché `sessions.forms(id)` que siembra el enriquecimiento del grafo. Así
    // una pregunta de una **sesión hija** se compone con su propio
    // `originSessionId` y `useReplyForm` responde al origen correcto.
    const pendingQuestionSessions = new Set(
      attention
        .filter((item) => item.kind === 'question')
        .map((item) => item.sessionId),
    );
    for (const sessionId of pendingQuestionSessions) {
      const forms =
        queryClient.getQueryData<FormInfo[]>(
          queryKeys.sessions.forms(sessionId),
        ) ?? [];
      for (const form of forms) {
        const key = `question:${form.id}`;
        if (seen.has(key)) continue;
        // Si el detalle ya está cacheado, se respeta su estado: una pregunta
        // resuelta no vuelve a la bandeja (FR-006/FR-011).
        const detail = queryClient.getQueryData<FormDetail>([
          ...queryKeys.sessions.forms(sessionId),
          form.id,
        ]);
        if (detail && detail.state.status !== 'pending') continue;
        seen.add(key);
        items.push({
          kind: 'question',
          originSessionId: sessionId,
          originLabel: labelFor(sessionId),
          question: toPendingQuestionEntry(form),
        });
      }
    }

    return items;
  }, [graph.graph.nodes, listedPermissions, attention, queryClient]);

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

  // Realce del grafo (T072, FR-009): el `Set` de nodos afectados se deriva de la
  // **única fuente** de atención y viaja por `GraphPane` → `AgentGraph` →
  // `useGraphFocusModel` hasta el contexto del nodo, sin tocar `data` ni
  // re-layoutar (Principio VII / FR-016). Un ítem sin nodo en el subárbol
  // (`nodeId === null`) no realza nada.
  const attentionNodeIds = useMemo(
    () =>
      new Set(
        attention
          .map((item) => item.nodeId)
          .filter((nodeId): nodeId is string => nodeId !== null),
      ),
    [attention],
  );

  // Badge de atención por raíz del rail (T073, FR-009): `useSessionAttention`
  // solo cubre el subárbol abierto, así que se cuentan los permisos de cada raíz
  // (con el árbol abierto cuando corresponde) más las preguntas del subárbol
  // abierto. Ver `countAttentionByRoot`.
  const attentionByRoot = useMemo(
    () =>
      countAttentionByRoot(
        items.map((item) => item.session.id),
        listedPermissions,
        id ?? null,
        new Set(graph.graph.nodes.map((node) => node.data.sessionId)),
        attention.filter((item) => item.kind === 'question').length,
      ),
    [items, listedPermissions, id, graph.graph.nodes, attention],
  );

  // La pestaña del detalle (`Detalle | Chat`) se controla desde la página para
  // poder abrir el Chat al navegar a la request origen (T055/FR-010).
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
      // Escritorio: abre la pestaña interna `Chat` del panel de detalle.
      setDetailTab(CHAT_TAB_ID);
      // Móvil (T076, FR-010): el tablist `Detalle | Chat` no se monta (FR-013),
      // así que la acción también cambia el tab de primer nivel del workspace a
      // `chat` para que el chat quede visible.
      if (isMobile) setTab('chat');
    },
    [selectNode, navigate, setDetailTab, isMobile],
  );

  // Aviso efímero accesible ante un pendiente nuevo (FR-009); deduplica por id.
  useAttentionNotifications(attention, handleGoToRequest);

  // Overlay del histórico (FR-008/012/014) y razonamiento compartido (FR-002).
  const { targetId, open, close, navigateTo } = useHistory();
  const reasoning = useReasoningVisibility();

  const {
    node: historyNode,
    lineage: historyLineage,
    missingId,
    clearMissing,
  } = useHistoryOverlay({
    graph: graph.graph,
    targetId,
    rootId,
    isLoading: graph.isLoading,
    isError: graph.isError,
    onClose: close,
  });

  // `Escape` (T062; chat-panel-contract §5): el `Escape` del composer (foco
  // dentro del panel de chat) cancela solo su estado inline y **no** se propaga;
  // fuera del composer, cierra primero la pantalla completa del panel
  // (US6/FR-015) y solo después limpia la selección del nodo. Una sola fuente de
  // lógica para ambas presentaciones; el listener se activa si hay fullscreen o
  // selección.
  const { isFullscreen, closeFullscreen } = panel;

  const handleEscape = useCallback(() => {
    if (isFocusWithinChat()) return;
    if (isFullscreen) {
      closeFullscreen();
      return;
    }
    clearSelection();
  }, [isFullscreen, closeFullscreen, clearSelection]);

  useEscapeKey(handleEscape, isFullscreen || selectedNodeId !== null);

  // Preguntas (FR-033) y contexto de compactación (FR-035) del histórico:
  // Infrastructure pide los datos al dominio Inspector y los inyecta por props.
  const historySessionId = historyNode?.data.sessionId ?? null;
  const historyForms = useSessionForms(historySessionId);
  const historyContext = useSessionContext(historySessionId);

  const rail = (
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

  // Panel de chat (T026/FR-008): se monta sobre la sesión abierta y se pasa como
  // slot a `InspectorPane`, que lo hospeda en la pestaña `Chat` (escritorio), y
  // como `chat` a `WorkspaceLayout`, que lo monta como tab de primer nivel en
  // móvil (T062/FR-013). La misma fuente de lógica (`useChatController`) alimenta
  // ambas presentaciones (FR-014). Sin sesión no hay chat.
  //
  // Semilla de la selección (T078, FR-008): se deriva del **nodo abierto**
  // (`data.sessionId === id`) para que `useChatController` arranque el agente y
  // el modelo vigentes del nodo y aplique `switch*` **solo si cambió**. Sin nodo,
  // ambos campos son `null` ("no cambiar").
  const chatSelectionSeed = useMemo<TChatSelectionSeed>(() => {
    const node = graph.graph.nodes.find(
      (candidate) => candidate.data.sessionId === id,
    );
    return {
      agent: node?.data.agentName ?? null,
      model: node?.data.model ?? null,
    };
  }, [graph.graph.nodes, id]);

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

  const inspectorPane = (
    <InspectorPane
      graph={graph.graph}
      parallelGroups={graph.parallelGroups}
      inspectedNodeId={inspectedNodeId}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onOpenHistory={open}
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
      node={historyNode}
      lineage={historyLineage}
      missingId={missingId}
      onClearMissing={clearMissing}
      showReasoning={reasoning.visible}
      onToggleReasoning={reasoning.toggle}
      onNavigate={navigateTo}
      onClose={close}
      questions={historyForms.questions}
      context={historyContext}
    />
  );

  return (
    <WorkspaceChatAttentionContext.Provider value={attention.length}>
      <WorkspaceLayout
        isMobile={Boolean(isMobile)}
        tab={tab}
        onChangeTab={setTab}
        sessions={rail}
        graph={graphPane}
        inspector={inspectorPane}
        chat={chatPane}
        history={historyOverlay}
        inspectorWidth={panel.width}
        isResizing={panel.isResizing}
        onResizeStart={panel.startResize}
        onResizeKey={panel.onResizeKey}
        isFullscreen={panel.isFullscreen}
      />
    </WorkspaceChatAttentionContext.Provider>
  );
};
