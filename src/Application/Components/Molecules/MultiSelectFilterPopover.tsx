import { useMemo } from 'react';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import {
  Button,
  Checkbox,
  Container,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@app/Application/Components';

/** Opción de un filtro multiselección. */
export interface TMultiSelectOption {
  /** Valor único de la opción. */
  value: string;
  /** Etiqueta principal visible. */
  label: string;
  /** Texto secundario (p. ej. ruta completa) que distingue homónimos. */
  secondary?: string;
}

interface MultiSelectFilterPopoverProps {
  /** Nombre base del disparador; se combina con `summary`. */
  ariaLabel: string;
  /** Resumen visible en el disparador (p. ej. "Todos", "2 proyectos"). */
  summary: string;
  /** Nombre accesible del grupo de opciones. */
  groupLabel: string;
  options: TMultiSelectOption[];
  /** Valores marcados; el vacío significa "todos". */
  selected: readonly string[];
  /** Marca/desmarca una opción. */
  onToggle: (value: string) => void;
  /** Clase de altura máxima de la lista con scroll propio. */
  maxHeightClass?: string;
}

const DEFAULT_MAX_HEIGHT_CLASS = 'max-h-64';

/**
 * Popover de multiselección con `Checkbox` (SH-15).
 *
 * Presentación pura: el disparador es un `Button` con nombre accesible que
 * incluye el resumen; cada opción anuncia su estado vía `aria-checked` y toma
 * como nombre la etiqueta más el texto secundario (resuelve homónimos). La lista
 * tiene altura máxima y scroll propio para no desplazar el listado. Conserva el
 * contrato de accesibilidad de la feature 005 §7. No accede al SDK ni a hooks.
 */
export const MultiSelectFilterPopover = ({
  ariaLabel,
  summary,
  groupLabel,
  options,
  selected,
  onToggle,
  maxHeightClass = DEFAULT_MAX_HEIGHT_CLASS,
}: MultiSelectFilterPopoverProps) => {
  const selectedValues = useMemo(() => new Set(selected), [selected]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          showIcon
          icon={faChevronDown}
          aria-label={`${ariaLabel}: ${summary}`}
        >
          {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <Container
          space="small"
          className={`${maxHeightClass} overflow-y-auto`}
          role="group"
          aria-label={groupLabel}
        >
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selectedValues.has(option.value)}
                onCheckedChange={() => onToggle(option.value)}
                aria-label={
                  option.secondary
                    ? `${option.label} ${option.secondary}`
                    : option.label
                }
                className="mt-0.5"
              />
              <Container space="none" className="min-w-0 flex-1">
                <span className="truncate text-sm text-foreground">
                  {option.label}
                </span>
                {option.secondary ? (
                  <span
                    className="truncate font-mono text-[11px] text-muted-foreground"
                    title={option.secondary}
                  >
                    {option.secondary}
                  </span>
                ) : null}
              </Container>
            </label>
          ))}
        </Container>
      </PopoverContent>
    </Popover>
  );
};
