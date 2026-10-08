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
 * Encabezado del card: tarea (máx. 2 líneas) + badge de paralelismo + pulso de
 * progreso (FR-022) + etiqueta de estado. El `title` del badge de paralelo es
 * contrato del spec (`N agentes ejecutados en paralelo`).
 */
export const AgentNodeHeader = ({
  title,
  agentName,
  parallel,
  isRunning,
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
      {isRunning ? (
        // Señal de progreso perceptible sin depender del texto en generación
        // (FR-022): pulso CSS puro.
        <span
          data-testid="agent-progress"
          aria-hidden
          className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-status-running"
        />
      ) : null}
      <span className="text-[11px] text-muted-foreground">
        {NODE_STATUS_LABEL[status]}
      </span>
    </span>
  </Container>
);
