import { Container } from '@app/Application/Components';
import {
  formatCost,
  formatDuration,
  formatSpeedup,
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
    /**
     * Aceleración global de la sesión (FR-008). Tipo estructural local —solo el
     * campo que se pinta— para no importar `TSessionSpeedup` de `Inspector` desde
     * un componente (AGENTS §8.3); `TSessionSummary` lo satisface.
     */
    sessionSpeedup?: { speedup: number | null } | null;
  };
}

/**
 * Resumen agregado de la sesión en la cabecera del grafo (FR-024..FR-027): la
 * **tira de métricas** (`<dl>` bordeado: coste, tokens, tiempo y paralelismo)
 * seguida de los **chips de estado** (LED + número + etiqueta). Envuelve en
 * anchos estrechos sin reordenar ni saltar el grafo (FR-027): las celdas tienen
 * ancho estable y los valores se actualizan en el sitio. Se alimenta del
 * `TSessionSummary` ya agregado por `summarizeSession`; es presentación pura y
 * no accede al SDK (Principio V).
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
      align="center"
      space="none"
      className="min-w-0 flex-wrap gap-x-3 gap-y-2"
    >
      <dl className="m-0 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
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
        <SummaryMetric
          label="Paralelismo"
          value={summary.sessionSpeedup?.speedup ?? null}
          format={formatSpeedup}
        />
      </dl>

      <Container row align="center" space="none" className="min-w-0 flex-wrap gap-1.5">
        {counters.map((counter) => (
          <SummaryCounterBadge key={counter.status} counter={counter} />
        ))}
      </Container>
    </Container>
  );
};
