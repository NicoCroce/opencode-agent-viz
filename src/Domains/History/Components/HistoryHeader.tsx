import { Container } from '@app/Application/Components';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { TLineageNav } from '../History.entity';
import { deriveHistoryHeaderView } from '../lib/historyHeaderView';
import { HistoryIdentity } from './HistoryIdentity';
import { HistoryLineageNav } from './HistoryLineageNav';
import { HistoryMetrics } from './HistoryMetrics';

interface HistoryHeaderProps {
  /** Nodo cuyo histórico se muestra: identidad, estado y métricas (FR-010). */
  node: TGraphNode;
  /** Padre e hijos del nodo para la navegación de linaje (FR-012). */
  lineage: TLineageNav;
  /** Cambia la sesión objetivo del overlay sin cerrarlo (FR-012). */
  onNavigate: (sessionId: string) => void;
}

/**
 * Cabecera del histórico (FR-010): identidad (título o nombre), modelo, estado,
 * coste, tokens, resultado final y directorio, con "no disponible" ante datos
 * ausentes (FR-038); incluye la navegación "Invocado por" / "Invocó a" del
 * linaje (FR-012) mediante `onNavigate`.
 *
 * Composición pura: la derivación vive en `deriveHistoryHeaderView` y cada
 * bloque en su subcomponente. No accede al SDK ni muta estado.
 */
export const HistoryHeader = ({
  node,
  lineage,
  onNavigate,
}: HistoryHeaderProps) => {
  const view = deriveHistoryHeaderView(node);

  return (
    <Container space="small" className="min-w-0">
      <HistoryIdentity
        title={view.title}
        status={view.status}
        agentName={view.agentName}
      />
      <HistoryMetrics view={view} />
      <HistoryLineageNav
        parentId={lineage.parentId}
        childrenIds={lineage.childrenIds}
        onNavigate={onNavigate}
      />
    </Container>
  );
};
