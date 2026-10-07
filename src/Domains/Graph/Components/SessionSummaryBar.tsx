import { Container, StatusDot } from '@app/Application/Components';
import {
  NODE_STATUS_LABEL,
  UNAVAILABLE,
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import type { TNodeStatus, TTokenUsage } from '../Graph.entity';
import type { TSessionSummary } from '../../Inspector/Inspector.entity';

export interface SessionSummaryBarProps {
  summary: TSessionSummary;
}

interface Counter {
  status: TNodeStatus;
  label: string;
  count: number;
  /** Se muestra siempre aunque esté en 0 (FR-024: en curso/esperando/error). */
  always: boolean;
}

/** Total de tokens consumidos (entrada + salida + razonamiento), o `null`. */
const totalTokens = (tokens: TTokenUsage | null): number | null => {
  if (!tokens) return null;
  const values = [tokens.input, tokens.output, tokens.reasoning].filter(
    (value): value is number => value !== null,
  );
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
};

/** Dato ausente → "no disponible" (FR-038), nunca un valor inventado ni un hueco. */
const Unavailable = () => (
  <span className="text-muted-foreground" aria-label="no disponible">
    {UNAVAILABLE}
    <span className="sr-only"> no disponible</span>
  </span>
);

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
 * (FR-019).
 */
export const SessionSummaryBar = ({ summary }: SessionSummaryBarProps) => {
  const allCounters: Counter[] = [
    {
      status: 'running',
      label: NODE_STATUS_LABEL.running,
      count: summary.runningCount,
      always: true,
    },
    {
      status: 'waiting-permission',
      label: 'Esperando',
      count: summary.waitingCount,
      always: true,
    },
    {
      status: 'failed',
      label: NODE_STATUS_LABEL.failed,
      count: summary.errorCount,
      always: true,
    },
    {
      status: 'retrying',
      label: NODE_STATUS_LABEL.retrying,
      count: summary.retryingCount,
      always: false,
    },
    {
      status: 'compacting',
      label: NODE_STATUS_LABEL.compacting,
      count: summary.compactingCount,
      always: false,
    },
    {
      status: 'succeeded',
      label: NODE_STATUS_LABEL.succeeded,
      count: summary.succeededCount,
      always: false,
    },
    {
      status: 'interrupted',
      label: NODE_STATUS_LABEL.interrupted,
      count: summary.interruptedCount,
      always: false,
    },
    {
      status: 'created',
      label: NODE_STATUS_LABEL.created,
      count: summary.createdCount,
      always: false,
    },
  ];

  const counters = allCounters.filter(
    (counter) => counter.always || counter.count > 0,
  );

  const tokens = totalTokens(summary.metrics.tokens);
  const cost = summary.metrics.cost;

  return (
    <Container
      row
      space="small"
      align="center"
      className="min-w-0 overflow-hidden whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground"
    >
      {counters.map((counter) => (
        <span
          key={counter.status}
          data-status={counter.status}
          className="flex shrink-0 items-center gap-1"
        >
          <StatusDot status={counter.status} />
          <span className="text-foreground">{counter.count}</span>
          <span>{counter.label}</span>
        </span>
      ))}

      <span aria-hidden>·</span>

      <span className="flex shrink-0 items-center gap-1">
        <span>Costo</span>
        {cost === null ? (
          <Unavailable />
        ) : (
          <span className="text-foreground">{formatCost(cost)}</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <span>Tokens</span>
        {tokens === null ? (
          <Unavailable />
        ) : (
          <span className="text-foreground">{formatTokens(tokens)}</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <span>Tiempo</span>
        {summary.elapsedMs === null ? (
          <Unavailable />
        ) : (
          <span className="text-foreground">
            {formatDuration(summary.elapsedMs)}
          </span>
        )}
      </span>
    </Container>
  );
};
