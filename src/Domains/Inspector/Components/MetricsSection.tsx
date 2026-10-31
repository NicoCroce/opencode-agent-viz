import { Container, Metric, SectionHeading } from '@app/Application/Components';
import {
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type { TNodeMetrics } from '@app/Domains/Graph/Graph.entity';
import { LoopBadge } from './LoopBadge';

interface MetricsSectionProps {
  metrics: TNodeMetrics;
}

/** Celda de la retícula de métricas: una lectura por instrumento. */
const Tile = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) => (
  <div className="min-w-0 rounded-lg border border-border/60 bg-surface-1/50 px-2.5 py-2">
    <Metric label={label} value={value} hint={hint} />
  </div>
);

export const MetricsSection = ({ metrics }: MetricsSectionProps) => (
  <Container space="small">
    <SectionHeading marker>Métricas</SectionHeading>
    <div className="grid grid-cols-3 gap-1.5">
      <Tile label="Duración" value={formatDuration(metrics.durationMs)} />
      <Tile label="Costo" value={formatCost(metrics.cost)} />
      <Tile
        label="Invocaciones"
        value={String(metrics.invocations)}
        hint={metrics.invocations > 1 ? 'repetidas' : undefined}
      />
      <Tile
        label="Tokens in"
        value={formatTokens(metrics.tokens?.input ?? null)}
      />
      <Tile
        label="Tokens out"
        value={formatTokens(metrics.tokens?.output ?? null)}
      />
      <Tile
        label="Razonamiento"
        value={formatTokens(metrics.tokens?.reasoning ?? null)}
      />
      <div className="col-span-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-1/50 px-2.5 py-2">
        <SectionHeading className="text-[9px] tracking-[0.14em]">
          Caché leída + escrita
        </SectionHeading>
        <span className="font-mono text-[13px] font-medium leading-none tabular-nums text-foreground">
          {formatTokens(
            metrics.tokens
              ? (metrics.tokens.cacheRead ?? 0) +
                  (metrics.tokens.cacheWrite ?? 0)
              : null,
          )}
        </span>
      </div>
    </div>
    {metrics.hasLoop ? (
      <LoopBadge
        retryCount={metrics.retryCount}
        evidence={metrics.loopEvidence}
      />
    ) : null}
  </Container>
);
