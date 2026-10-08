import { UnavailableValue } from '@app/Application/Components/Molecules';

interface SummaryMetricProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
}

/**
 * Métrica etiquetada de la barra de resumen (FR-025..FR-027): etiqueta y valor
 * formateado, o "no disponible" ante un dato ausente (FR-038). El formato lo
 * aporta el consumidor (`formatCost`/`formatTokens`/`formatDuration`).
 * Presentación pura; no accede al SDK.
 */
export const SummaryMetric = ({ label, value, format }: SummaryMetricProps) => (
  <span className="flex shrink-0 items-center gap-1">
    <span>{label}</span>
    {value === null ? (
      <UnavailableValue />
    ) : (
      <span className="text-foreground">{format(value)}</span>
    )}
  </span>
);
