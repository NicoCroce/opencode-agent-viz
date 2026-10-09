import { Container, StatusDot } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

interface HistoryIdentityProps {
  /** Título o, en su defecto, nombre del agente (FR-010). */
  title: string;
  /** Estado del nodo: controla el punto de color y su etiqueta. */
  status: TNodeStatus;
  /** Nombre del agente, mostrado junto al estado. */
  agentName: string;
}

/**
 * Identidad de la cabecera del histórico (FR-010): título o nombre, y estado con
 * su punto de color y el nombre del agente. Presentación pura.
 */
export const HistoryIdentity = ({
  title,
  status,
  agentName,
}: HistoryIdentityProps) => (
  <Container space="small" className="min-w-0">
    <span className="truncate text-sm font-semibold leading-snug text-foreground">
      {title}
    </span>
    <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <StatusDot status={status} />
      <span className="text-foreground">{NODE_STATUS_LABEL[status]}</span>
      <span aria-hidden>·</span>
      <span className="truncate">{agentName}</span>
    </span>
  </Container>
);
