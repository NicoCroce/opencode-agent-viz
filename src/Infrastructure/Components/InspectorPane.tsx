import { useCallback } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { Container } from '@app/Application/Components';
import {
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from '@app/Application/Helpers/panelWidth';
import { InspectorPanel } from '@app/Domains/Inspector';
import type { TGraphModel, TParallelGroup } from '@app/Domains/Graph';
import { useInspectedNodeContext } from '../Hooks/useInspectedNodeContext';

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
}

/**
 * Panel del inspector: deriva el contexto del nodo inspeccionado (nodo, peers,
 * invocador) y rinde `InspectorPanel`. `InspectorPanel` se importa por el
 * **barrel** de dominio para que el `vi.mock('@app/Domains/Inspector')` de los
 * specs siga interceptándolo.
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
}: InspectorPaneProps) => {
  const { node, peers, invokedBy } = useInspectedNodeContext({
    graph,
    parallelGroups,
    inspectedNodeId,
  });

  const handleOpenHistory = useCallback(() => {
    if (!node) return;
    onOpenHistory(node.data.sessionId);
  }, [node, onOpenHistory]);

  return (
    <Container
      block
      className={`h-full min-h-0 ${isResizing ? 'select-none' : ''}`}
      data-resizing={isResizing || undefined}
    >
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
