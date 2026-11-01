import { Container } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type {
  TLatencyReport,
  TNodeParallelism,
  TNodeSpeedup,
  TNodeStatus,
} from '../Graph.entity';
import { AgentNodeLatencyMark } from './AgentNodeLatencyMark';
import { AgentNodeSpeedupBadge } from './AgentNodeSpeedupBadge';
import { NODE_CARD_TONE } from './nodeCardTone';

interface AgentNodeHeaderProps {
  /** Título de la tarea; si falta, se muestra el nombre del agente. */
  title: string | null;
  agentName: string;
  /** Paralelismo del nodo; `null` cuando corrió solo. */
  parallel: TNodeParallelism | null;
  /** Aceleración real del grupo; `null` cuando corrió solo (FR-009). */
  speedup: TNodeSpeedup | null;
  /** Serie de latencia del nodo; `null` hasta el enriquecimiento (FR-023). */
  latency: TLatencyReport | null;
  status: TNodeStatus;
}

/**
 * Encabezado del card: tarea (máx. 2 líneas) a la izquierda y un **cluster meta**
 * a la derecha con punto de estado + badge de paralelismo + badge de aceleración
 * + marca de anomalía de latencia + etiqueta de estado (mono 10 px en versalitas,
 * en el color del estado según `NODE_CARD_TONE`; el LED activo lleva halo).
 * El punto es decorativo (`aria-hidden`): el detalle preciso lo da la etiqueta y
 * el escaneo periférico, la barra superior (`NodeStatusRail`, FR-001). El título
 * usa `leading-[17px]` para casar con `cardHeight.TITLE_LINE`. El medidor de
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
  speedup,
  latency,
  status,
}: AgentNodeHeaderProps) => {
  const tone = NODE_CARD_TONE[status];

  return (
    <Container
      row
      align="start"
      justify="between"
      space="small"
      className="min-w-0"
    >
      <span
        className={cn(
          'line-clamp-2 min-w-0 flex-1 text-[13px] leading-[17px]',
          tone.title,
        )}
      >
        {title ?? agentName}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            tone.rail,
            tone.glow && 'glow-accent',
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
        <AgentNodeSpeedupBadge speedup={speedup} />
        <AgentNodeLatencyMark latency={latency} />
        <span
          className={cn(
            'font-mono text-[10px] uppercase leading-4 tracking-[0.08em]',
            tone.label,
          )}
        >
          {NODE_STATUS_LABEL[status]}
        </span>
      </span>
    </Container>
  );
};
