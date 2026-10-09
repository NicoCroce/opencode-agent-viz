import { Select, type TOptions } from './Select';

interface LabeledSelectProps {
  /** Nombre accesible del control; se anuncia como texto solo-lectores. */
  label: string;
  /** Valor controlado; el `Select` refleja el valor externo. */
  value: string;
  /** Notifica el valor elegido. */
  onChange: (value: string) => void;
  /** Opciones del `Select` (`{ value, label }`). */
  options: TOptions[];
  /** Placeholder del `Select`. */
  placeholder: string;
}

/**
 * `Select` con nombre accesible (SH-15).
 *
 * Presentación pura que envuelve el `Select` compartido en un `<label>` con un
 * texto solo-lectores, porque el `Select` no acepta `aria-label`. Conserva el
 * contrato de accesibilidad del filtro (feature 005 §7): el disparador
 * (`combobox`) queda nombrado por el `label` y anuncia el valor activo. No accede
 * al SDK ni a hooks.
 */
export const LabeledSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder,
}: LabeledSelectProps) => (
  <label>
    <span className="sr-only">{label}</span>
    <Select
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={placeholder}
    />
  </label>
);
