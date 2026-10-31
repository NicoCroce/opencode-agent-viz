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
 * completo, agente + estado como cápsulas y directorio. La jerarquía la lleva
 * el título en la tipografía de display; las cápsulas son datos, no botones.
 */
export const InspectorIdentity = ({
  node,
  invokedBy = null,
}: InspectorIdentityProps) => (
  <Container space="small">
    <h2 className="font-display text-[17px] font-semibold leading-snug tracking-[-0.025em] text-foreground">
      {node.data.title ?? node.data.agentName}
    </h2>

    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-surface-1/70 px-2 py-0.5">
        <StatusDot status={node.data.status} />
        <span className="min-w-0 truncate font-mono text-[10px] text-foreground/80">
          {node.data.agentName}
        </span>
      </span>
      <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {NODE_STATUS_LABEL[node.data.status]}
      </span>
    </div>

    <span
      className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/80"
      title={node.data.directory}
    >
      <span aria-hidden className="text-signal/80">
        #
      </span>
      <span className="truncate">{folderName(node.data.directory)}</span>
    </span>

    {invokedBy ? (
      <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/80">
        Invocado por{' '}
        <span className="text-foreground/90">
          {invokedBy.data.title ?? invokedBy.data.agentName}
        </span>
      </span>
    ) : null}
  </Container>
);
