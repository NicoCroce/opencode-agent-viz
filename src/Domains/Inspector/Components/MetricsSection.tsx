import { Container, Metric } from '@app/Application/Components';
import { SectionHeading } from '@app/Application/Components/Molecules';
import {
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type { TNodeMetrics } from '@app/Domains/Graph/Graph.entity';
import { LoopBadge } from './LoopBadge';

/** Rejilla de baldosas de métricas: dos columnas, 8px entre baldosas. */
const METRICS_GRID_CLASSNAME = 'grid grid-cols-2 gap-2';

interface MetricsSectionProps {
  metrics: TNodeMetrics;
}

/**
 * Métricas del nodo (FR-004) como rejilla de dos columnas de baldosas
 * (`Metric variant="tile"`): duración, costo, invocaciones y tokens. El aviso de
 * loop cuelga del mismo contenedor que el encabezado.
 */
export const MetricsSection = ({ metrics }: MetricsSectionProps) => (
  <Container space="small">
    <SectionHeading>Métricas</SectionHeading>
    <Container block className={METRICS_GRID_CLASSNAME}>
      <Metric
        variant="tile"
        label="Duración"
        value={formatDuration(metrics.durationMs)}
      />
      <Metric variant="tile" label="Costo" value={formatCost(metrics.cost)} />
      <Metric
        variant="tile"
        label="Invocaciones"
        value={String(metrics.invocations)}
        hint={metrics.invocations > 1 ? 'ejecutado varias veces' : undefined}
      />
      <Metric
        variant="tile"
        label="Tokens in"
        value={formatTokens(metrics.tokens?.input ?? null)}
      />
      <Metric
        variant="tile"
        label="Tokens out"
        value={formatTokens(metrics.tokens?.output ?? null)}
      />
      <Metric
        variant="tile"
        label="Razonamiento"
        value={formatTokens(metrics.tokens?.reasoning ?? null)}
      />
      <Metric
        variant="tile"
        label="Caché"
        value={formatTokens(
          metrics.tokens
            ? (metrics.tokens.cacheRead ?? 0) + (metrics.tokens.cacheWrite ?? 0)
            : null,
        )}
      />
    </Container>
    {metrics.hasLoop ? (
      <LoopBadge
        retryCount={metrics.retryCount}
        evidence={metrics.loopEvidence}
      />
    ) : null}
  </Container>
);
