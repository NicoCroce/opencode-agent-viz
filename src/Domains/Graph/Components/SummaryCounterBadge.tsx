import { StatusDot } from '@app/Application/Components';
import type { TSummaryCounter } from '../lib/summaryCounters';

interface SummaryCounterBadgeProps {
  counter: TSummaryCounter;
}

/**
 * Contador por estado de la barra de resumen (FR-024): punto de color, número y
 * etiqueta. Conserva `data-status` en el elemento que consulta el spec y recibe
 * el contador ya resuelto por `buildSummaryCounters` (agrupación de esperas y
 * regla `always`). Presentación pura.
 */
export const SummaryCounterBadge = ({ counter }: SummaryCounterBadgeProps) => (
  <span
    data-status={counter.status}
    className="flex shrink-0 items-center gap-1"
  >
    <StatusDot status={counter.status} />
    <span className="text-foreground">{counter.count}</span>
    <span>{counter.label}</span>
  </span>
);
