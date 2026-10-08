import { Container, StatusDot } from '@app/Application/Components';
import { NODE_STATUS_LABEL, folderName } from '@app/Application/Helpers';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';

interface InspectorIdentityProps {
  node: TGraphNode;
  /** Nodo que invocó a `node` (relación padre → hijo), si lo hay. */
  invokedBy?: TGraphNode | null;
}

/**
 * Encabezado de identidad del nodo seleccionado (FR-001/SC-003): título
 * completo (sin cortar), agente + estado y directorio, más el origen si el
 * nodo fue invocado.
 */
export const InspectorIdentity = ({
  node,
  invokedBy = null,
}: InspectorIdentityProps) => (
  <Container space="small">
    <span className="text-sm font-semibold leading-snug text-foreground">
      {node.data.title ?? node.data.agentName}
    </span>
    <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <StatusDot status={node.data.status} />
      <span className="text-foreground">{node.data.agentName}</span>
      <span aria-hidden>·</span>
      <span>{NODE_STATUS_LABEL[node.data.status]}</span>
    </span>
    <span
      className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"
      title={node.data.directory}
    >
      <span aria-hidden className="text-accent">
        #
      </span>
      <span className="truncate">{folderName(node.data.directory)}</span>
    </span>
    {invokedBy ? (
      <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
        Invocado por{' '}
        <span className="text-foreground">
          {invokedBy.data.title ?? invokedBy.data.agentName}
        </span>
      </span>
    ) : null}
  </Container>
);
