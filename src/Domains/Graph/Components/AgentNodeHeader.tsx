import { Container } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { NODE_STATUS_COLOR } from '@app/Application/Helpers/nodeStatusColor';
import { cn } from '@app/Application/lib/utils';
import type { TNodeParallelism, TNodeStatus } from '../Graph.entity';

interface AgentNodeHeaderProps {
  /** Título de la tarea; si falta, se muestra el nombre del agente. */
  title: string | null;
  agentName: string;
  /** Paralelismo del nodo; `null` cuando corrió solo. */
  parallel: TNodeParallelism | null;
  isRunning: boolean;
  status: TNodeStatus;
}

/**
 * Encabezado del card: tarea (máx. 2 líneas) a la izquierda y un **cluster meta**
 * a la derecha con punto de estado + badge de paralelismo + etiqueta de estado.
 * El punto es decorativo (`aria-hidden`): el detalle preciso lo da la etiqueta y
 * el escaneo periférico, el rail (`NodeStatusRail`, FR-001). El medidor de
 * esfuerzo (FR-026) **no** va aquí: vive en su banda al pie del card
 * (`AgentNodeEffortBand`), así que el encabezado reserva el cluster de estado
 * (`cardHeight.STATUS_WIDTH`). El `title` del badge de paralelo es contrato del
 * spec (`N agentes ejecutados en paralelo`). El encabezado ya no muestra el pulso
 * `animate-pulse` (active-node-feedback-contract §1).
 */
export const AgentNodeHeader = ({
  title,
  agentName,
  parallel,
  status,
}: AgentNodeHeaderProps) => (
  <Container row align="start" justify="between" space="small" className="min-w-0">
    <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-snug text-foreground">
      {title ?? agentName}
    </span>
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          'inline-block size-1.5 shrink-0 rounded-full',
          NODE_STATUS_COLOR[status],
        )}
      />
      {parallel ? (
        <span
          className="rounded-flat border border-foreground/40 px-1 font-mono text-[10px] leading-4 text-foreground"
          title={`${parallel.size} agentes ejecutados en paralelo`}
        >
          {`∥${parallel.size}`}
        </span>
      ) : null}
      <span className="text-[11px] text-muted-foreground">
        {NODE_STATUS_LABEL[status]}
      </span>
    </span>
  </Container>
);
