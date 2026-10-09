import { cn } from '@app/Application/lib/utils';
import {
  UNAVAILABLE,
  UNAVAILABLE_LABEL,
} from '@app/Application/Helpers/format/constants';

interface UnavailableValueProps {
  /** Texto del valor ausente; por defecto, "no disponible" (FR-038). */
  label?: string;
  /** Clases extra para ajustar la tipografía del consumidor. */
  className?: string;
}

/**
 * Marcador de dato ausente (FR-038): `—` visible y el texto para tecnologías de
 * asistencia, nunca un valor inventado ni un hueco.
 *
 * Presentación pura que centraliza el patrón que hoy repiten `SessionSummaryBar`
 * (`Unavailable`), `HistoryHeader` y `Metric`. Usa `UNAVAILABLE_LABEL` como
 * fuente única del texto "no disponible". No accede al SDK ni a hooks.
 */
export const UnavailableValue = ({
  label = UNAVAILABLE_LABEL,
  className,
}: UnavailableValueProps) => (
  <span className={cn('text-muted-foreground', className)} aria-label={label}>
    {UNAVAILABLE}
    <span className="sr-only"> {label}</span>
  </span>
);
