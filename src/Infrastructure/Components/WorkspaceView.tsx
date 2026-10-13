import type { ReactNode } from 'react';
import type { TUseInspectorPanelResult } from '../Hooks/useInspectorPanel';
import type { TWorkspaceTab } from '../WorkspacePage.constants';
import { WorkspaceLayout } from './WorkspaceLayout';
import { WorkspaceChatAttentionContext } from './WorkspaceMobileTabs';

interface WorkspaceViewProps {
  /** Rail de sesiones raíz (`SessionsRail`), construido por la página. */
  sessions: ReactNode;
  /** Panel del grafo (`GraphPane`), construido por la página. */
  graph: ReactNode;
  /** Panel de detalle (`InspectorPane`); hospeda el chat en escritorio. */
  inspector: ReactNode;
  /**
   * Panel de chat (`ChatPanel`), el **mismo** nodo que hospeda `inspector` en
   * escritorio. Es `null` cuando no hay sesión abierta, así que la vista nunca
   * lo construye: lo recibe ya armado (FR-008/FR-013/FR-014).
   */
  chat: ReactNode;
  /** Overlay del histórico (`HistoryOverlay`), montado en ambas presentaciones. */
  history: ReactNode;
  /** Estado de vista del panel de detalle (`useInspectorPanel`, US5/US6). */
  panel: TUseInspectorPanelResult;
  /**
   * Pendientes de atención (FR-009). Viaja por `WorkspaceChatAttentionContext`
   * para el badge del tablist móvil, sin re-derivarlo aquí.
   */
  attentionCount: number;
  /** Presentación: móvil (`WorkspaceMobileTabs`) o escritorio (tres columnas). */
  isMobile: boolean;
  /** Pestaña activa de primer nivel del workspace (solo móvil). */
  tab: TWorkspaceTab;
  onChangeTab: (tab: TWorkspaceTab) => void;
}

/**
 * Vista del workspace: componente **presentacional puro**, sin lógica de datos
 * ni acceso al SDK/Query. Recibe los cinco slots ya construidos (`sessions`,
 * `graph`, `inspector`, `chat`, `history`) más el estado de vista (`panel`,
 * `attentionCount`, `isMobile`, `tab`, `onChangeTab`) y compone el provider de
 * atención del chat con `WorkspaceLayout`, con **exactamente** las mismas props
 * que antes montaba `WorkspacePage` (FR-005, contrato de superficie congelada).
 *
 * No envuelve los slots en wrappers por bloque (decisión de plan/research): los
 * cinco componentes de dominio se reutilizan tal cual y aquí solo se cablean. La
 * lógica cross-domain (`useChatPending`, `useWorkspaceEscape`, `useHistoryData`,
 * …) vive en los hooks de Infrastructure y en la página; por eso este archivo no
 * declara estado, memos ni efectos.
 */
export const WorkspaceView = ({
  sessions,
  graph,
  inspector,
  chat,
  history,
  panel,
  attentionCount,
  isMobile,
  tab,
  onChangeTab,
}: WorkspaceViewProps) => (
  <WorkspaceChatAttentionContext.Provider value={attentionCount}>
    <WorkspaceLayout
      isMobile={isMobile}
      tab={tab}
      onChangeTab={onChangeTab}
      sessions={sessions}
      graph={graph}
      inspector={inspector}
      chat={chat}
      history={history}
      inspectorWidth={panel.width}
      isResizing={panel.isResizing}
      onResizeStart={panel.startResize}
      onResizeKey={panel.onResizeKey}
      isFullscreen={panel.isFullscreen}
    />
  </WorkspaceChatAttentionContext.Provider>
);
