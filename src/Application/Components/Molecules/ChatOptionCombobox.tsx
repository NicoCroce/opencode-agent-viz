import { useId, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { cn } from '@/Application/lib/utils';
import { Container, Label } from '@app/Application/Components';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { TOptions } from './Select';

export interface ChatOptionComboboxProps {
  /** Nombre accesible del control (solo lector de pantalla, sin label visible). */
  label: string;
  /** Valor controlado; vacío muestra el placeholder. */
  value: string;
  /** Texto mostrado cuando no hay valor. */
  placeholder: string;
  options: TOptions[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Texto del estado vacío cuando el filtro no encuentra coincidencias. */
  emptyText?: string;
}

/**
 * Chip compacto (estilo Copilot) con **buscador interno**, para listas largas de
 * agente/modelo.
 *
 * Sustituye al `ui/select` (Radix Select) por el patrón `Popover` + `Command`
 * (cmdk): el disparador sigue siendo una pastilla redondeada con el valor vigente
 * y un chevron, pero el desplegable incluye un **input de búsqueda** que filtra
 * por etiqueta (case-insensitive) y una lista con **altura máxima** y scroll.
 *
 * a11y (WCAG 2.2 AA): el disparador es un `<button>` con `role="combobox"`,
 * `aria-expanded` y `aria-haspopup="listbox"` (patrón combobox select-only); el
 * input de búsqueda interno recibe su nombre accesible del `label` de `Command`
 * ("Buscar …"). Se abre con Enter/Espacio, se navega con flechas y se cierra con
 * `Escape`; el foco es visible y el estado nunca se comunica solo por color.
 */
export const ChatOptionCombobox = ({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  disabled = false,
  emptyText = 'Sin resultados',
}: ChatOptionComboboxProps) => {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const searchLabel = `Buscar ${label.toLowerCase()}`;
  const selected = options.find((option) => option.value === value);

  const handleSelect = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };

  return (
    <Container row align="center" className="w-auto min-w-0">
      <Label htmlFor={triggerId} className="sr-only">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className="inline-flex h-8 w-auto min-w-0 cursor-pointer items-center justify-between gap-1 rounded-full border border-input bg-transparent px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={cn(
                'truncate max-w-[12rem]',
                !selected && 'text-muted-foreground',
              )}
            >
              {selected?.label ?? placeholder}
            </span>
            <ChevronDownIcon
              className="h-3 w-3 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command label={searchLabel}>
            <CommandInput autoFocus placeholder={`${searchLabel}…`} />
            <CommandList
              label={`Opciones de ${label.toLowerCase()}`}
              className="max-h-60"
            >
              <CommandEmpty>{emptyText}</CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Container>
  );
};
