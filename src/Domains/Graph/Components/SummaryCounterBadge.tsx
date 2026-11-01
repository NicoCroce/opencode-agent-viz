import { StatusDot } from '@app/Application/Components';
import { cn } from '@app/Application/lib/utils';
import type { TSummaryCounter } from '../lib/summaryCounters';

interface SummaryCounterBadgeProps {
  counter: TSummaryCounter;
}

/**
 * Chip de contador por estado de la cabecera (FR-024): LED de color, número y
 * etiqueta en mono. El LED de "en curso" con agentes lleva el halo del acento;
 * un contador en 0 se atenúa sin ocultarse (FR-024 los muestra siempre).
 * Conserva `data-status` en el elemento que consulta el spec y recibe el
 * contador ya resuelto por `buildSummaryCounters`. Presentación pura.
 */
export const SummaryCounterBadge = ({ counter }: SummaryCounterBadgeProps) => (
  <span
    data-status={counter.status}
    className={cn(
      'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 font-mono text-[11px] tabular-nums text-muted-foreground',
      counter.count === 0 && 'opacity-60',
    )}
  >
    <StatusDot
      status={counter.status}
      className={cn(
        'size-1.5',
        counter.status === 'running' && counter.count > 0 && 'glow-accent',
      )}
    />
    <span className="text-foreground">{counter.count}</span>
    <span>{counter.label}</span>
  </span>
);
