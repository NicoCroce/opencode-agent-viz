import { Container } from '@app/Application/Components';
import { formatSpeedup } from '@app/Application/Helpers';
import { formatClock } from '@app/Application/Helpers/format/clock';
import { cn } from '@app/Application/lib/utils';
import type {
  TLatencyAnomaly,
  TLatencySample,
} from '@app/Domains/Graph/Graph.entity';
import { describeLatencySample, formatLatency } from '../lib/latencyBreakdown';

interface LatencySampleRowProps {
  sample: TLatencySample;
  /** Posición 1-based en la serie. */
  position: number;
  /** Anomalía de la respuesta, si fue lenta. */
  anomaly: TLatencyAnomaly | null;
}

/**
 * Una respuesta de la serie de latencia: hora, total, marca de lentitud y, debajo,
 * en qué se fue el tiempo. El primer tramo del desglose es la causa principal y
 * se resalta; el orden ya la comunica sin depender del color.
 */
export const LatencySampleRow = ({
  sample,
  position,
  anomaly,
}: LatencySampleRowProps) => {
  const details = describeLatencySample(sample);

  return (
    <Container
      space="none"
      role="listitem"
      className="min-w-0 gap-0.5 font-mono text-[11px] tabular-nums"
    >
      <Container
        row
        align="center"
        justify="between"
        space="small"
        className="min-w-0 gap-2"
      >
        <span className="min-w-0 truncate text-muted-foreground">
          {`#${position} · ${formatClock(sample.startedAt)}`}
        </span>
        <Container row align="center" space="small" className="shrink-0 gap-2">
          <span className="text-foreground">
            {`total ${formatLatency(sample.totalMs)}`}
          </span>
          {anomaly ? (
            <span className="rounded-flat border border-status-error/80 px-1 text-[10px] text-status-error">
              {`Lenta ${formatSpeedup(anomaly.ratio)}`}
            </span>
          ) : null}
        </Container>
      </Container>
      {details.length > 0 ? (
        <p className="min-w-0 text-[10px] leading-4 text-muted-foreground">
          {details.map((text, index) => (
            <span
              key={text}
              className={cn(index === 0 && 'text-foreground/80')}
            >
              {index > 0 ? ` · ${text}` : text}
            </span>
          ))}
        </p>
      ) : null}
    </Container>
  );
};
