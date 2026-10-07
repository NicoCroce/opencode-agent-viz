import { Container, Metric } from '@app/Application/Components';
import { formatCost, formatDuration, formatTokens } from '@app/Application/Helpers';
import type { TNodeMetrics } from '@app/Domains/Graph/Graph.entity';
import { LoopBadge } from './LoopBadge';

interface MetricsSectionProps {
  metrics: TNodeMetrics;
}

export const MetricsSection = ({ metrics }: MetricsSectionProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Métricas
    </span>
    <Container row space="medium" className="flex-wrap">
      <Metric label="Duración" value={formatDuration(metrics.durationMs)} />
      <Metric label="Costo" value={formatCost(metrics.cost)} />
      <Metric
        label="Invocaciones"
        value={String(metrics.invocations)}
        hint={metrics.invocations > 1 ? 'ejecutado varias veces' : undefined}
      />
    </Container>
    <Container row space="medium" className="flex-wrap">
      <Metric label="Tokens in" value={formatTokens(metrics.tokens?.input ?? null)} />
      <Metric label="Tokens out" value={formatTokens(metrics.tokens?.output ?? null)} />
      <Metric
        label="Razonamiento"
        value={formatTokens(metrics.tokens?.reasoning ?? null)}
      />
      <Metric
        label="Caché"
        value={formatTokens(
          metrics.tokens
            ? (metrics.tokens.cacheRead ?? 0) + (metrics.tokens.cacheWrite ?? 0)
            : null,
        )}
      />
    </Container>
    {metrics.hasLoop ? (
      <LoopBadge retryCount={metrics.retryCount} evidence={metrics.loopEvidence} />
    ) : null}
  </Container>
);
