import { Container } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
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
 * Encabezado del card: tarea (máx. 2 líneas) + badge de paralelismo + etiqueta
 * de estado. El medidor de esfuerzo (FR-026) ya **no** va aquí: se ancla a la
 * esquina inferior derecha del card (`AgentNode`), así que el encabezado solo
 * reserva el ancho del estado y del badge (`cardHeight.STATUS_WIDTH`). El
 * `title` del badge de paralelo es contrato del spec (`N agentes ejecutados en
 * paralelo`). La señal principal de actividad es el barrido del rail
 * (`NodeStatusRail`, FR-001); el encabezado ya no muestra el pulso
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
    <span className="flex shrink-0 items-center gap-1">
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
