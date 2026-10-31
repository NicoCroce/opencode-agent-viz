import { UnavailableValue } from '@app/Application/Components/Molecules';
import { UNAVAILABLE_LABEL } from '@app/Application/Helpers/format/constants';

interface SummaryMetricProps {
  label: string;
  /** Etiqueta corta visible; `label` queda como nombre accesible. */
  compactLabel?: string;
  value: number | null;
  format: (value: number) => string;
}

/**
 * Métrica etiquetada de la barra de resumen (FR-025..FR-027): etiqueta y valor
 * formateado, o "no disponible" ante un dato ausente (FR-038). El formato lo
 * aporta el consumidor (`formatCost`/`formatTokens`/`formatDuration`).
 * Presentación pura; no accede al SDK.
 */
export const SummaryMetric = ({
  label,
  compactLabel,
  value,
  format,
}: SummaryMetricProps) => {
  const formatted = value === null ? null : format(value);

  return (
    <span
      className="flex shrink-0 items-center gap-1"
      title={label}
      {...(compactLabel
        ? { 'aria-label': `${label} ${formatted ?? UNAVAILABLE_LABEL}` }
        : {})}
    >
      <span
        aria-hidden={compactLabel ? true : undefined}
        className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/75"
      >
        {compactLabel ?? label}
      </span>
      {value === null ? (
        <UnavailableValue />
      ) : (
        <span className="font-mono text-[10px] text-foreground/90">
          {formatted}
        </span>
      )}
    </span>
  );
};
