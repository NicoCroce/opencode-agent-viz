import { useCallback } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
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
   * Estado de arrastre del separador (US5). El ancho lo aplica la columna del
   * layout; aquí solo se refleja el arrastre para estabilizar el contenido
   * (evita selección de texto mientras se redimensiona).
   */
  isResizing?: boolean;
  /** Estado de pantalla completa del panel (US6/FR-013). */
  isFullscreen?: boolean;
  /** Alterna la pantalla completa; se reenvía al encabezado del panel (US6). */
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
 * (`ChatAttentionBadge`, T053) cuando hay pendientes en el subárbol. El
 * resize/fullscreen de la columna siguen intactos: se aplican a la columna
 * completa y cubren ambos tabs.
 */
export const InspectorPane = ({
  graph,
  parallelGroups,
  inspectedNodeId,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
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
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
  );

  return (
    <Container
      block
      className={`h-full min-h-0 ${isResizing ? 'select-none' : ''}`}
      data-resizing={isResizing || undefined}
    >
      {showDetailTabs ? (
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex h-full min-h-0 flex-col"
        >
          <TabsList
            aria-label="Vistas del panel de detalle"
            className="m-2 shrink-0 self-start"
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
