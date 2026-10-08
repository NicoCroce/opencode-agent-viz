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
import type { TProjectOption } from '../lib/sessionFilters';

interface ProjectFilterProps {
  /** Catálogo de proyectos con al menos una sesión (FR-004), sin filtrar. */
  options: TProjectOption[];
  /** Directorios marcados; `[]` significa "todos" (FR-003). */
  selected: string[];
  /** Marca/desmarca un proyecto (multiselección, FR-002). */
  onToggle: (directory: string) => void;
}

/** Resumen del disparador cuando no hay ningún proyecto marcado (FR-003). */
const ALL_PROJECTS_LABEL = 'Todos';

/** Resumen del disparador: `Todos` o el número de proyectos marcados. */
const projectsSummary = (count: number): string => {
  if (count === 0) return ALL_PROJECTS_LABEL;
  return count === 1 ? '1 proyecto' : `${count} proyectos`;
};

/**
 * Filtro de proyecto del listado de sesiones (feature 005, FR-001..FR-005).
 *
 * Multiselección basada en `Popover` + `Checkbox` de Radix. Cada opción muestra
 * el nombre de la carpeta como etiqueta principal y la ruta completa en
 * monoespaciado truncado como texto secundario, de modo que dos proyectos
 * homónimos se distinguen por su ruta (FR-023, SC-008). Sin marcas, la selección
 * significa "todos" (FR-003). La lista tiene altura máxima y scroll propio para
 * no desplazar el listado cuando hay muchos proyectos (edge case).
 *
 * Es presentación pura: no conoce la URL ni el estado de filtros; recibe
 * `options`/`selected` y delega el cambio en `onToggle` (Principio V).
 */
export const ProjectFilter = ({
  options,
  selected,
  onToggle,
}: ProjectFilterProps) => {
  const selectedDirectories = useMemo(() => new Set(selected), [selected]);
  const summary = projectsSummary(selected.length);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          showIcon
          icon={faChevronDown}
          aria-label={`Filtrar por proyecto: ${summary}`}
        >
          {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <Container
          space="small"
          className="max-h-64 overflow-y-auto"
          role="group"
          aria-label="Proyectos"
        >
          {options.map((option) => (
            <label
              key={option.directory}
              className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selectedDirectories.has(option.directory)}
                onCheckedChange={() => onToggle(option.directory)}
                aria-label={`${option.name} ${option.path}`}
                className="mt-0.5"
              />
              <Container space="none" className="min-w-0 flex-1">
                <span className="truncate text-sm text-foreground">
                  {option.name}
                </span>
                <span
                  className="truncate font-mono text-[11px] text-muted-foreground"
                  title={option.path}
                >
                  {option.path}
                </span>
              </Container>
            </label>
          ))}
        </Container>
      </PopoverContent>
    </Popover>
  );
};
