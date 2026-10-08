import { Select } from '@app/Application/Components';
import { TIME_RANGES, type TTimeRange } from '../lib/sessionFilters';

interface TimeRangeFilterProps {
  /** Rango temporal activo; `all` por defecto (FR-008). */
  value: TTimeRange;
  /** Notifica el rango elegido (FR-006, FR-007). */
  onChange: (range: TTimeRange) => void;
}

/** Opciones del `Select` derivadas de la tabla de rangos (FR-007). */
const RANGE_OPTIONS = TIME_RANGES.map(({ value, label }) => ({ value, label }));

/** Placeholder del `Select`; con `value` siempre presente nunca se muestra. */
const RANGE_PLACEHOLDER = 'Todo';

/** Nombre accesible del control, anunciado a tecnologías de asistencia (FR-021). */
const RANGE_FILTER_LABEL = 'Filtrar por recencia';

/** Estrecha un valor emitido por el `Select` al conjunto cerrado de rangos. */
const isTimeRange = (value: string): value is TTimeRange =>
  TIME_RANGES.some((option) => option.value === value);

/**
 * Filtro temporal de recencia del listado de sesiones (feature 005,
 * FR-006..FR-009).
 *
 * Reutiliza el `Select` de `Application/Components` en modo **controlado**:
 * refleja el rango activo (`value`) y delega el cambio en `onChange`. Las
 * opciones provienen de `TIME_RANGES` (conjunto cerrado, FR-007), con `all`
 * ("Todo") como valor por defecto (FR-008).
 *
 * El control se envuelve en un `<label>` con un texto solo-lectores que nombra
 * el propósito ("Filtrar por recencia"), porque el `Select` compartido no
 * acepta `aria-label`; el rango activo se anuncia como valor del `combobox`
 * (FR-021).
 *
 * Es presentación pura: no conoce la URL ni evalúa el rango (eso vive en
 * `sessionFilters.ts`); solo presenta y notifica (Principio V).
 */
export const TimeRangeFilter = ({ value, onChange }: TimeRangeFilterProps) => (
  <label>
    <span className="sr-only">{RANGE_FILTER_LABEL}</span>
    <Select
      value={value}
      onValueChange={(next) => {
        if (isTimeRange(next)) onChange(next);
      }}
      options={RANGE_OPTIONS}
      placeholder={RANGE_PLACEHOLDER}
    />
  </label>
);
