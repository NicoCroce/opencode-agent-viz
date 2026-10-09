import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { Container } from '@app/Application/Components';
import { InspectorResizeHandle } from './InspectorPane';
import { WorkspaceMobileTabs } from './WorkspaceMobileTabs';
import type { TWorkspaceTab } from '../WorkspacePage.constants';

interface WorkspaceLayoutProps {
  isMobile: boolean;
  tab: TWorkspaceTab;
  onChangeTab: (tab: TWorkspaceTab) => void;
  sessions: ReactNode;
  graph: ReactNode;
  inspector: ReactNode;
  history: ReactNode;
  /** Ancho actual del panel de detalle en px (US5/FR-010..FR-012). */
  inspectorWidth: number;
  /** `true` mientras se arrastra el separador (feedback `--status-running`). */
  isResizing: boolean;
  onResizeStart: (event: ReactPointerEvent) => void;
  onResizeKey: (event: ReactKeyboardEvent) => void;
  /**
   * `true` cuando el panel de detalle ocupa el área de trabajo (US6/FR-013). En
   * fullscreen el **mismo** `inspector` se monta en un overlay con fondo
   * `--surface-0` y el separador de escritorio no se monta.
   */
  isFullscreen: boolean;
}

/**
 * Presentación del workspace: elige entre la vista móvil (`WorkspaceMobileTabs`,
 * tablist + panel activo) y la vista desktop (rail de sesiones, panel del grafo
 * y panel del inspector en tres columnas). Recibe los paneles ya armados como
 * `ReactNode` para que la elección de presentación no duplique lógica
 * (AGENTS §9). El overlay del histórico se monta en ambas presentaciones.
 *
 * En desktop se inserta el separador de resize entre el grafo y el inspector y
 * el ancho se aplica a la columna del inspector; en móvil **no** se monta el
 * separador (el panel sigue siendo una pestaña), con una sola fuente de lógica
 * (`useInspectorPanel`) y dos presentaciones (FR-012; inspector-panel-contract §1/§3).
 *
 * Con `isFullscreen`, la **misma** columna del inspector pasa a ser un overlay
 * `absolute inset-0` con fondo `--surface-0` que cubre el área de trabajo; no se
 * duplica el render y el separador no se monta (US6/FR-014).
 */
export const WorkspaceLayout = ({
  isMobile,
  tab,
  onChangeTab,
  sessions,
  graph,
  inspector,
  history,
  inspectorWidth,
  isResizing,
  onResizeStart,
  onResizeKey,
  isFullscreen,
}: WorkspaceLayoutProps) => {
  if (isMobile) {
    return (
      <>
        <WorkspaceMobileTabs
          tab={tab}
          onChange={onChangeTab}
          sessions={sessions}
          graph={graph}
          inspector={inspector}
        />
        {history}
      </>
    );
  }

  return (
    <>
      <Container row space="none" className="relative h-full min-h-0">
        <Container
          space="none"
          className="w-[280px] shrink-0 overflow-auto border-r border-border"
        >
          {sessions}
        </Container>
        <Container block className="min-h-0 flex-1">
          {graph}
        </Container>
        {!isFullscreen ? (
          <InspectorResizeHandle
            width={inspectorWidth}
            isResizing={isResizing}
            onResizeStart={onResizeStart}
            onResizeKey={onResizeKey}
          />
        ) : null}
        <Container
          block
          data-testid="inspector-column"
          data-fullscreen={isFullscreen || undefined}
          className={`shrink-0 border-border ${
            isFullscreen
              ? 'absolute inset-0 z-20 overflow-auto border-l-0 bg-surface-0'
              : 'overflow-auto border-l'
          }`}
          style={isFullscreen ? undefined : { width: inspectorWidth }}
        >
          {inspector}
        </Container>
      </Container>
      {history}
    </>
  );
};
