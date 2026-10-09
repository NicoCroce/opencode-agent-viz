import type { ReactNode } from 'react';
import { Button, Container, EmptyScreenError } from '@app/Application/Components';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { THistoryQuestion, TLineageNav } from '../History.entity';
import { useHistoryPagination } from '../Hooks/useHistoryPagination';
import { HistoryHeader } from './HistoryHeader';
import { HistorySkeleton } from './HistorySkeleton';
import { HistoryTimeline } from './HistoryTimeline';

interface HistoryModalProps {
  /** Nodo cuya sesión se muestra: identidad, estado y métricas (FR-010). */
  node: TGraphNode;
  /** Padre e hijos del nodo para la navegación de linaje (FR-012). */
  lineage: TLineageNav;
  /** Visibilidad del razonamiento (FR-002); la posee `WorkspacePage`. */
  showReasoning: boolean;
  /** Alterna la visibilidad del razonamiento (FR-002). */
  onToggleReasoning: () => void;
  /** Cambia la sesión objetivo al padre/hijo sin cerrar el overlay (FR-012). */
  onNavigate: (sessionId: string) => void;
  /** Cierra el overlay y devuelve al grafo conservando la selección (FR-014). */
  onClose: () => void;
  /**
   * Preguntas al usuario de la sesión (FR-033), provistas por el llamador
   * (`WorkspacePage` vía `useSessionForms`). Se incorporan al histórico en su
   * posición cronológica ancladas a su tool call.
   */
  questions?: THistoryQuestion[];
  /**
   * Render del contexto de compactación (FR-035), inyectado por el llamador
   * (que pide los datos con `useSessionContext`). Se reenvía al timeline.
   */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Overlay a pantalla completa con el histórico íntegro de un agente o
 * subagente (FR-008/010/015).
 *
 * Superficie `--surface-1` con cabecera fija (`HistoryHeader`, más el toggle de
 * razonamiento y el cierre) y un timeline scrollable con carga progresiva
 * (`HistoryTimeline`). Renderiza los estados obligatorios en orden:
 * error → loading → vacío → datos (FR-015); el vacío lo muestra el timeline con
 * su estado explícito. Es presentación pura: los datos llegan de
 * `useHistoryPagination` y las acciones se delegan por props.
 */
export const HistoryModal = ({
  node,
  lineage,
  showReasoning,
  onToggleReasoning,
  onNavigate,
  onClose,
  questions = [],
  renderCompactionContext,
}: HistoryModalProps) => {
  const {
    entries,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useHistoryPagination(node.data.sessionId, questions);

  const renderTimeline = () => {
    if (isError) {
      return (
        <EmptyScreenError message="No se pudo cargar el histórico de la sesión." />
      );
    }
    if (isLoading) return <HistorySkeleton />;
    return (
      <HistoryTimeline
        entries={entries}
        showReasoning={showReasoning}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isFetchNextPageError={isFetchNextPageError}
        fetchNextPage={fetchNextPage}
        sessionId={node.data.sessionId}
        renderCompactionContext={renderCompactionContext}
      />
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de ejecución"
      className="fixed inset-0 z-50 flex flex-col bg-surface-1"
    >
      <header className="flex flex-col gap-3 border-b border-border bg-surface-1 p-4">
        <Container
          row
          space="medium"
          justify="between"
          align="start"
          className="flex-wrap"
        >
          <HistoryHeader node={node} lineage={lineage} onNavigate={onNavigate} />
          <Container row space="small" align="center">
            <Button
              variant="outline"
              onClick={onToggleReasoning}
              aria-pressed={showReasoning}
            >
              {showReasoning ? 'Ocultar razonamiento' : 'Ver razonamiento'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              aria-label="Cerrar histórico"
            >
              Cerrar
            </Button>
          </Container>
        </Container>
      </header>

      <div className="flex-1 overflow-y-auto p-4">{renderTimeline()}</div>
    </div>
  );
};
