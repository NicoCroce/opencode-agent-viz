import { useCallback, useEffect, useRef } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMaximize, faMinimize } from '@fortawesome/free-solid-svg-icons';
import {
  Container,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/Application/Components';
import {
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from '@app/Application/Helpers/panelWidth';
import { InspectorPanel } from '@app/Domains/Inspector';
import type { TGraphModel, TParallelGroup } from '@app/Domains/Graph';
import { ChatAttentionBadge } from '@app/Domains/Chat';
import { useInspectedNodeContext } from '../Hooks/useInspectedNodeContext';
import {
  CHAT_TAB_ID,
  DETAIL_TAB_ID,
  isDetailTab,
  useDetailTabs,
  type TDetailTab,
} from '../Hooks/useDetailTabs';

interface InspectorPaneProps {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  inspectedNodeId: string | null;
  showReasoning: boolean;
  onToggleReasoning: () => void;
  onOpenHistory: (sessionId: string) => void;
  /**
   * Selecciona otro nodo del grafo por su id de sesión (FR-014). Se reenvía a
   * `InspectorPanel` para que el apartado "Aporte al padre" navegue al agente
   * que invocó al nodo inspeccionado. Cuando la selección cambia **por esta
   * navegación**, el foco vuelve al contenedor del panel (el control de origen
   * se desmonta); las selecciones desde el grafo no lo alteran.
   */
  onSelectNode?: (id: string) => void;
  /**
   * Estado de arrastre del separador (US5). El ancho lo aplica la columna del
   * layout; aquí solo se refleja el arrastre para estabilizar el contenido
   * (evita selección de texto mientras se redimensiona).
   */
  isResizing?: boolean;
  /** Estado de pantalla completa de la columna (US6/FR-013). */
  isFullscreen?: boolean;
  /**
   * Alterna la pantalla completa. El control vive en la **cabecera de la
   * columna** (junto al tablist `Detalle | Chat`) para que esté disponible en
   * ambos tabs y aplique a la columna completa (U6). Sin handler, no se monta.
   */
  onToggleFullscreen?: () => void;
  /**
   * Slot del panel `Chat` (T026). Mientras no se cablee `ChatPanel`, la pestaña
   * `Chat` queda como un `tabpanel` vacío listo para recibirlo.
   */
  chat?: ReactNode;
  /**
   * Monta el tablist interno `Detalle | Chat` (escritorio). En móvil el chat es
   * un destino de primer nivel, así que la presentación pasa `false` para no
   * anidar tabbars (FR-013/FR-014). Por defecto `true`.
   */
  showDetailTabs?: boolean;
  /**
   * Nº de pendientes del subárbol de la sesión abierta (T053/FR-009). Con `> 0`
   * el trigger de la pestaña `Chat` monta `ChatAttentionBadge` (token ≥3:1 +
   * marca no-color + `aria-label` textual). La fuente es `useSessionAttention`,
   * cableada en `WorkspacePage` (data-fetching cross-domain en Infrastructure).
   */
  attentionCount?: number;
  /**
   * Tab activo **controlado** por el llamador (T055/FR-010). Permite abrir la
   * pestaña `Chat` al navegar a la request origen. Sin él, el estado es interno
   * (`useDetailTabs`), preservando el uso actual.
   */
  activeTab?: TDetailTab;
  /** Cambio de tab controlado (T055); acompaña a `activeTab`. */
  onTabChange?: (tab: TDetailTab) => void;
}

/**
 * Panel del inspector: deriva el contexto del nodo inspeccionado (nodo, peers,
 * invocador) y rinde `InspectorPanel`. `InspectorPanel` se importa por el
 * **barrel** de dominio para que el `vi.mock('@app/Domains/Inspector')` de los
 * specs siga interceptándolo.
 *
 * La columna se envuelve en **Radix Tabs** (`ui/tabs.tsx`) con `Detalle | Chat`
 * siguiendo el patrón APG (`tablist`/`tab`/`tabpanel`, `aria-controls`, flechas,
 * roving tabindex; FR-021). El estado del tab activo vive en `useDetailTabs`
 * (única fuente de lógica, FR-014), salvo cuando el llamador lo **controla**
 * (`activeTab`/`onTabChange`) para abrir la pestaña `Chat` al navegar a la
 * request origen (T055/FR-010). El trigger de `Chat` muestra el badge de atención
 * (`ChatAttentionBadge`, T053) cuando hay pendientes en el subárbol. La cabecera
 * de la columna (junto al tablist) monta el control de pantalla completa cuando
 * el llamador aporta `onToggleFullscreen`: vive fuera de los tabpanels, así que
 * está disponible en `Detalle` y `Chat` y aplica a la columna completa (U6). El
 * resize/fullscreen siguen intactos: se aplican a la columna completa y cubren
 * ambos tabs.
 */
export const InspectorPane = ({
  graph,
  parallelGroups,
  inspectedNodeId,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
  onSelectNode,
  isResizing = false,
  isFullscreen = false,
  onToggleFullscreen,
  chat,
  showDetailTabs = true,
  attentionCount = 0,
  activeTab,
  onTabChange,
}: InspectorPaneProps) => {
  const { node, peers, invokedBy } = useInspectedNodeContext({
    graph,
    parallelGroups,
    inspectedNodeId,
  });
  const detailTabs = useDetailTabs();
  // Estado controlado si el llamador lo aporta (T055); si no, estado interno.
  const tab = activeTab ?? detailTabs.tab;
  const setTab = onTabChange ?? detailTabs.setTab;

  // FR-014 (a11y): al activar "Ir al agente padre" el nodo seleccionado cambia y
  // el control que tenía el foco se desmonta, dejando el foco en `body`. El
  // contenedor del panel es un destino de foco (`tabIndex={0}`), así que se
  // recuerda el nodo destino y se devuelve el foco ahí tras el cambio. Las
  // selecciones hechas desde el grafo no tocan `navigateTargetRef`, de modo que
  // el foco no se roba (click/teclado en el grafo).
  const paneRef = useRef<HTMLDivElement>(null);
  const navigateTargetRef = useRef<string | null>(null);

  const handleNavigateToNode = useCallback(
    (id: string) => {
      if (!onSelectNode) return;
      navigateTargetRef.current = id;
      onSelectNode(id);
    },
    [onSelectNode],
  );

  useEffect(() => {
    const target = navigateTargetRef.current;
    if (target === null || target !== inspectedNodeId) return;
    navigateTargetRef.current = null;
    paneRef.current?.focus();
  }, [inspectedNodeId]);

  const handleOpenHistory = useCallback(() => {
    if (!node) return;
    onOpenHistory(node.data.sessionId);
  }, [node, onOpenHistory]);

  // Radix entrega el `value` como `string`; se valida antes de fijar el tab.
  const handleTabChange = useCallback(
    (value: string) => {
      if (isDetailTab(value)) setTab(value);
    },
    [setTab],
  );

  const panel = (
    <InspectorPanel
      node={node}
      parallelPeers={peers}
      invokedBy={invokedBy}
      showReasoning={showReasoning}
      onToggleReasoning={onToggleReasoning}
      onOpenHistory={handleOpenHistory}
      onNavigateToNode={onSelectNode ? handleNavigateToNode : undefined}
    />
  );

  return (
    <Container
      block
      ref={paneRef}
      tabIndex={0}
      aria-label="Panel de detalle"
      data-testid="inspector-pane"
      className={`h-full min-h-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        isResizing ? 'select-none' : ''
      }`}
      data-resizing={isResizing || undefined}
    >
      {showDetailTabs ? (
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex h-full min-h-0 flex-col"
        >
          {/*
            Cabecera de la columna: tablist `Detalle | Chat` (APG) + control de
            pantalla completa. El control vive aquí, junto al tablist, para
            estar disponible en **ambos** tabs y aplicar a la columna completa
            (U6); reusa `isFullscreen`/`onToggleFullscreen` sin estado propio.
          */}
          <Container
            row
            space="small"
            justify="between"
            align="center"
            className="shrink-0"
          >
            <TabsList
              aria-label="Vistas del panel de detalle"
              className="m-2 shrink-0"
            >
              {detailTabs.tabs.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                  {item.id === CHAT_TAB_ID ? (
                    <ChatAttentionBadge count={attentionCount} />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
            {onToggleFullscreen ? (
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={
                  isFullscreen
                    ? 'Salir de pantalla completa'
                    : 'Pantalla completa'
                }
                onClick={onToggleFullscreen}
                className="mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-flat text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <FontAwesomeIcon
                  icon={isFullscreen ? faMinimize : faMaximize}
                  aria-hidden
                />
              </button>
            ) : null}
          </Container>
          <TabsContent
            value={DETAIL_TAB_ID}
            className="mt-0 min-h-0 flex-1 overflow-auto"
          >
            {panel}
          </TabsContent>
          <TabsContent
            value={CHAT_TAB_ID}
            data-testid="detail-chat-slot"
            className="mt-0 min-h-0 flex-1 overflow-auto"
          >
            {chat ?? null}
          </TabsContent>
        </Tabs>
      ) : (
        panel
      )}
    </Container>
  );
};

interface InspectorResizeHandleProps {
  width: number;
  isResizing: boolean;
  onResizeStart: (event: ReactPointerEvent) => void;
  onResizeKey: (event: ReactKeyboardEvent) => void;
}

/**
 * Separador vertical accesible del panel de detalle (SC-007). Expone el ancho
 * actual (`aria-valuenow`) y sus límites; la zona de agarre es de 12 px con una
 * barra visible de 4 px, `--surface-2` en reposo y `--status-running` mientras
 * se arrastra. La lógica de puntero/teclado vive en `useInspectorPanel`; aquí
 * solo se reenvían los handlers que recibe del layout (FR-010..FR-012).
 */
export const InspectorResizeHandle = ({
  width,
  isResizing,
  onResizeStart,
  onResizeKey,
}: InspectorResizeHandleProps) => (
  <Container
    row
    space="none"
    role="separator"
    aria-orientation="vertical"
    aria-label="Ajustar el ancho del panel de detalle"
    aria-valuenow={width}
    aria-valuemin={INSPECTOR_MIN_WIDTH}
    aria-valuemax={INSPECTOR_MAX_WIDTH}
    tabIndex={0}
    data-testid="inspector-resize-handle"
    onPointerDown={onResizeStart}
    onKeyDown={onResizeKey}
    className="relative z-10 w-3 shrink-0 cursor-col-resize touch-none items-stretch justify-center"
  >
    <span
      aria-hidden="true"
      className={`w-1 transition-colors ${
        isResizing ? 'bg-status-running' : 'bg-surface-2'
      }`}
    />
  </Container>
);
