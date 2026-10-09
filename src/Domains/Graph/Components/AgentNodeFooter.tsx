import { Container } from '@app/Application/Components';
import {
  formatCost,
  formatDateTimeRange,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import { UNAVAILABLE_LABEL } from '@app/Application/Helpers/format/constants';
import { totalTokens } from '@app/Application/Helpers/totalTokens';
import type {
  TCurrentTool,
  TGraphNodeData,
  TNodeMetrics,
  TNodeStatus,
} from '../Graph.entity';

interface AgentNodeFooterProps {
  metrics: TNodeMetrics;
  isRunning: boolean;
  status: TNodeStatus;
  currentTool: TCurrentTool | null;
  retry: TGraphNodeData['retry'];
  interruptReason: string | null;
}

/**
 * Pie del card: consumo (tokens · costo · duración), rango horario y, cuando
 * aplica, herramienta en curso (FR-018), reintento (FR-018) e interrupción
 * (FR-019). Los valores ausentes caen a "no disponible" (edge case).
 *
 * Las líneas que pueden quedar por debajo del medidor de esfuerzo —anclado a la
 * esquina inferior derecha del card— reservan el canal derecho (`pr-7`, ~28 px,
 * `EFFORT_METER_WIDTH`) para que el texto no quede tapado. La fila de consumo no
 * lo reserva: es `flex-wrap` y reservarlo cambiaría el alto estimado del pie.
 */
export const AgentNodeFooter = ({
  metrics,
  isRunning,
  status,
  currentTool,
  retry,
  interruptReason,
}: AgentNodeFooterProps) => {
  const timeRange = formatDateTimeRange({
    startedAt: metrics.startedAt,
    endedAt: metrics.endedAt,
    isRunning,
  });
  const tokens = totalTokens(metrics.tokens);

  // Reintento (FR-018): número de intento y, si el servidor lo reporta, el
  // momento del próximo. `next` ausente → "no disponible" (edge case).
  const retryLabel = retry
    ? `Intento ${retry.attempt} · próximo ${
        retry.next !== null ? formatClock(retry.next) : UNAVAILABLE_LABEL
      }`
    : null;

  // Motivo de la interrupción (FR-019): distingue una interrupción de un fallo
  // propio. Motivo ausente → "no disponible".
  const interruptLabel =
    status === 'interrupted'
      ? `Motivo: ${interruptReason ?? UNAVAILABLE_LABEL}`
      : null;

  return (
    <Container
      space="none"
      className="mt-auto min-w-0 gap-1 border-t border-border pt-1.5"
    >
      <Container
        row
        align="center"
        space="none"
        className="min-w-0 flex-wrap gap-x-1.5 font-mono text-[11px] tabular-nums text-muted-foreground"
      >
        <span>
          {tokens === null ? formatTokens(null) : `${formatTokens(tokens)} tok`}
        </span>
        <span aria-hidden>·</span>
        <span>{formatCost(metrics.cost)}</span>
        <span aria-hidden>·</span>
        <span>{formatDuration(metrics.durationMs)}</span>
      </Container>
      <span className="min-w-0 truncate pr-7 font-mono text-[11px] tabular-nums text-muted-foreground">
        {timeRange}
      </span>
      {currentTool ? (
        <span
          className="min-w-0 truncate pr-7 font-mono text-[11px] text-foreground/80"
          title={currentTool.name}
        >
          {currentTool.name}
        </span>
      ) : null}
      {retryLabel ? (
        <span
          className="min-w-0 truncate pr-7 font-mono text-[11px] tabular-nums text-status-running"
          title={retryLabel}
        >
          {retryLabel}
        </span>
      ) : null}
      {interruptLabel ? (
        <span
          className="min-w-0 truncate pr-7 font-mono text-[11px] text-status-error"
          title={interruptLabel}
        >
          {interruptLabel}
        </span>
      ) : null}
    </Container>
  );
};
