import { cn } from '@/Application/lib/utils';
import {
  Select as SelectLib,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export type TOptions = {
  value: string;
  label: string;
};

interface SelectProps {
  placeholder: string;
  onValueChange: (value: string) => void;
  options: TOptions[];
  /** Valor inicial del modo no controlado. Opcional (retrocompatible). */
  defaultValue?: string;
  /** Valor controlado. Si se aporta, el control refleja el valor externo. */
  value?: string;
  /**
   * Clases extra aplicadas al `SelectTrigger` interno. Permite ajustar el ancho
   * del disparador (por defecto `w-auto`, que se dimensiona al contenido y
   * evita recortar la etiqueta más larga del dominio, "Últimas 24 horas").
   */
  className?: string;
  forceEnabled?: boolean;
}

/**
 * Ancho por defecto del disparador: crece con el contenido (`w-auto`) en lugar
 * de fijar `w-20` (80 px), insuficiente para "Últimas 24 horas". `min-w-20`
 * mantiene la altura/anchura mínima cuando la etiqueta es corta.
 */
const DEFAULT_TRIGGER_CLASS = 'w-auto min-w-20';

export const Select = ({
  options,
  placeholder,
  onValueChange,
  defaultValue,
  value,
  className,
  forceEnabled = false,
}: SelectProps) => {
  const isControlled = value !== undefined;

  return (
    <SelectLib
      onValueChange={onValueChange}
      {...(isControlled ? { value } : { defaultValue })}
    >
      <SelectTrigger
        className={cn(DEFAULT_TRIGGER_CLASS, className)}
        forceEnabled={forceEnabled}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(({ value: optionValue, label }) => (
            <SelectItem key={optionValue} value={optionValue}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectLib>
  );
};
