import {
  CompactionContext,
  Container,
  EmptyState,
} from '@app/Application/Components';
import { HistoryModal, type TLineageNav } from '@app/Domains/History';
import type { TGraphNode } from '@app/Domains/Graph';
import type { TQuestionEntry } from '@app/Application/Helpers';
import type { TSessionContextResult } from '@app/Domains/Inspector';

interface HistoryOverlayProps {
  node: TGraphNode | null;
  lineage: TLineageNav;
  missingId: string | null;
  onClearMissing: () => void;
  showReasoning: boolean;
  onToggleReasoning: () => void;
  onNavigate: (sessionId: string) => void;
  onClose: () => void;
  questions: TQuestionEntry[];
  context: TSessionContextResult;
}

/**
 * Overlay del histórico: el modal cuando el objetivo está en el grafo, o un
 * estado "no disponible" cuando el objetivo desapareció (edge case). El
 * diálogo usa `Container` en vez de un `div` con `flex` (AGENTS §8.4),
 * conservando `role="dialog"`, `aria-modal` y `aria-label`.
 *
 * `HistoryModal` se importa por el **barrel** de dominio para que el
 * `vi.mock('@app/Domains/History')` de los specs siga interceptándolo.
 */
export const HistoryOverlay = ({
  node,
  lineage,
  missingId,
  onClearMissing,
  showReasoning,
  onToggleReasoning,
  onNavigate,
  onClose,
  questions,
  context,
}: HistoryOverlayProps) => {
  if (node) {
    return (
      <HistoryModal
        node={node}
        lineage={lineage}
        showReasoning={showReasoning}
        onToggleReasoning={onToggleReasoning}
        onNavigate={onNavigate}
        onClose={onClose}
        questions={questions}
        renderCompactionContext={() => (
          <CompactionContext
            messages={context.messages}
            isError={context.isError}
            isLoading={context.isLoading}
          />
        )}
      />
    );
  }

  if (!missingId) return null;

  return (
    <Container
      align="center"
      justify="center"
      space="none"
      className="fixed inset-0 z-50 bg-surface-1 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Histórico no disponible"
    >
      <EmptyState
        title="Histórico no disponible"
        description="El agente ya no está en el grafo."
        action={{
          label: 'Cerrar',
          onClick: onClearMissing,
          variant: 'outline',
        }}
      />
    </Container>
  );
};
