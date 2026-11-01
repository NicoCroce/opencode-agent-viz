import { UnavailableValue } from '@app/Application/Components/Molecules';

interface SummaryMetricProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
}

/**
 * Celda de la tira de métricas de la cabecera (FR-025..FR-027): etiqueta mono
 * en versalitas y valor formateado, o "no disponible" ante un dato ausente
 * (FR-038). Va dentro del `<dl>` de `SessionSummaryBar`, cuyo `gap-px` sobre
 * fondo de borde dibuja los separadores (2×2 en móvil, 4 en fila desde `sm`).
 * El formato lo aporta el consumidor
 * (`formatCost`/`formatTokens`/`formatDuration`). Presentación pura.
 */
export const SummaryMetric = ({ label, value, format }: SummaryMetricProps) => (
  <div className="min-w-0 bg-surface-1 px-3 py-2 sm:px-4">
    <dt className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-status-idle">
      {label}
    </dt>
    <dd className="mt-0.5 truncate font-mono text-[15px] leading-5 tabular-nums text-foreground">
      {value === null ? <UnavailableValue /> : format(value)}
    </dd>
  </div>
);
