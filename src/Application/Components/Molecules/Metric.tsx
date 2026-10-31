import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { SectionHeading } from './SectionHeading';
import { UnavailableValue } from './UnavailableValue';

/**
 * Presentación de la métrica:
 * - `inline` (por defecto): etiqueta + dato compactos, para filas o rejillas
 *   densas (Eficiencia, Histórico).
 * - `tile`: baldosa con borde de la rejilla de métricas del detalle (etiqueta
 *   mono de 10px atenuada y dato mono de 18px).
 */
export type TMetricVariant = 'inline' | 'tile';

/** Baldosa de métrica (radio 10px, borde de superficie, padding 12px). */
export const METRIC_TILE_CLASSNAME = 'rounded-[10px] border border-border p-3';

/** Etiqueta de la baldosa: mono 10px en versalitas, tono `idle`. */
export const METRIC_TILE_LABEL_CLASSNAME =
  'text-[10px] font-normal tracking-[0.12em] text-status-idle';

const VALUE_CLASSNAME: Record<TMetricVariant, string> = {
  inline: 'font-mono text-sm font-medium tabular-nums text-foreground',
  tile: 'font-mono text-lg leading-tight tabular-nums text-foreground',
};

const UNAVAILABLE_CLASSNAME: Record<TMetricVariant, string> = {
  inline: 'font-mono text-sm tabular-nums',
  tile: 'font-mono text-sm leading-7 tabular-nums',
};

interface MetricProps {
  label: string;
  value: string | null;
  hint?: string;
  /** Presentación (por defecto `inline`); ver `TMetricVariant`. */
  variant?: TMetricVariant;
  className?: string;
}

export const Metric = ({
  label,
  value,
  hint,
  variant = 'inline',
  className,
}: MetricProps) => {
  const unavailable = value === null || value === undefined;
  const isTile = variant === 'tile';

  return (
    <Container
      space="none"
      className={cn(
        isTile ? `${METRIC_TILE_CLASSNAME} min-w-0 gap-1!` : 'gap-0.5!',
        className,
      )}
    >
      <SectionHeading className={cn(isTile && METRIC_TILE_LABEL_CLASSNAME)}>
        {label}
      </SectionHeading>
      {unavailable ? (
        <UnavailableValue className={UNAVAILABLE_CLASSNAME[variant]} />
      ) : (
        <span
          className={cn(VALUE_CLASSNAME[variant], isTile && 'min-w-0 truncate')}
        >
          {value}
        </span>
      )}
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </Container>
  );
};
