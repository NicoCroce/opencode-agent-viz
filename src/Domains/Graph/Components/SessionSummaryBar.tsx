import { Container } from '@app/Application/Components';
import {
  formatCost,
  formatDuration,
  formatTokens,
  totalTokens,
} from '@app/Application/Helpers';
import type { TNodeMetrics } from '../Graph.entity';
import {
  buildSummaryCounters,
  type TSummaryCounts,
} from '../lib/summaryCounters';
import { SummaryCounterBadge } from './SummaryCounterBadge';
import { SummaryMetric } from './SummaryMetric';

/**
 * Datos que la barra consume: contadores por estado (`TSummaryCounts`) + coste,
 * tokens y tiempo. Tipo estructural local para no importar `TSessionSummary` de
 * `Inspector` desde un componente (AGENTS §8.3); `TSessionSummary` lo satisface
 * sin tocar a sus consumidores.
 */
export interface SessionSummaryBarProps {
  summary: TSummaryCounts & {
    metrics: Pick<TNodeMetrics, 'cost' | 'tokens'>;
    elapsedMs: number | null;
  };
}

/**
 * Barra de resumen agregado de la sesión (FR-024..FR-027): contadores por
 * estado, coste, tokens y tiempo transcurrido. Tira monoespaciada y de altura
 * fija que se actualiza en el sitio, sin reordenar ni saltar el grafo
 * (FR-027). Se alimenta del `TSessionSummary` ya agregado por
 * `summarizeSession`; es presentación pura y no accede al SDK (Principio V).
 *
 * Los contadores de en curso, esperando y con error se muestran siempre
 * (FR-024); el resto de estados solo cuando tienen agentes. Las dos esperas se
 * agrupan bajo "Esperando" y una interrupción nunca se cuenta como error
 * (FR-019). La construcción de contadores vive en `buildSummaryCounters`.
 */
export const SessionSummaryBar = ({ summary }: SessionSummaryBarProps) => {
  const counters = buildSummaryCounters(summary).filter(
    (counter) => counter.always || counter.count > 0,
  );

  const tokens = totalTokens(summary.metrics.tokens);

  return (
    <Container
      row
      space="small"
      align="center"
      className="min-w-0 overflow-hidden whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground"
    >
      {counters.map((counter) => (
        <SummaryCounterBadge key={counter.status} counter={counter} />
      ))}

      <span aria-hidden>·</span>

      <SummaryMetric
        label="Costo"
        value={summary.metrics.cost}
        format={formatCost}
      />
      <SummaryMetric label="Tokens" value={tokens} format={formatTokens} />
      <SummaryMetric
        label="Tiempo"
        value={summary.elapsedMs}
        format={formatDuration}
      />
    </Container>
  );
};
