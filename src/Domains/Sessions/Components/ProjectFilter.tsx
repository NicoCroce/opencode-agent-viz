import { MultiSelectFilterPopover } from '@app/Application/Components/Molecules/MultiSelectFilterPopover';
import { summarizeProjects, type TProjectOption } from '../lib/sessionFilters';

interface ProjectFilterProps {
  /** Catálogo de proyectos con al menos una sesión (FR-004), sin filtrar. */
  options: TProjectOption[];
  /** Directorios marcados; `[]` significa "todos" (FR-003). */
  selected: string[];
  /** Marca/desmarca un proyecto (multiselección, FR-002). */
  onToggle: (directory: string) => void;
}

/** Nombre base del disparador; se combina con el resumen (FR-021). */
const PROJECT_FILTER_LABEL = 'Filtrar por proyecto';

/** Nombre accesible del grupo de opciones (FR-021). */
const PROJECTS_GROUP_LABEL = 'Proyectos';

/**
 * Filtro de proyecto del listado de sesiones (feature 005, FR-001..FR-005).
 *
 * Multiselección basada en `Popover` + `Checkbox` de Radix a través de la
 * molécula `MultiSelectFilterPopover` (SH-15). Cada opción muestra el nombre de
 * la carpeta como etiqueta principal y la ruta completa en monoespaciado
 * truncado como texto secundario, de modo que dos proyectos homónimos se
 * distinguen por su ruta (FR-023, SC-008). Sin marcas, la selección significa
 * "todos" (FR-003). La lista tiene altura máxima y scroll propio para no
 * desplazar el listado cuando hay muchos proyectos (edge case).
 *
 * Es presentación pura: no conoce la URL ni el estado de filtros; recibe
 * `options`/`selected` y delega el cambio en `onToggle` (Principio V).
 */
export const ProjectFilter = ({
  options,
  selected,
  onToggle,
}: ProjectFilterProps) => (
  <MultiSelectFilterPopover
    ariaLabel={PROJECT_FILTER_LABEL}
    summary={summarizeProjects(selected.length)}
    groupLabel={PROJECTS_GROUP_LABEL}
    options={options.map((option) => ({
      value: option.directory,
      label: option.name,
      secondary: option.path,
    }))}
    selected={selected}
    onToggle={onToggle}
  />
);
