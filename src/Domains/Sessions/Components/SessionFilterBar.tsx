import { Button, Container } from '@app/Application/Components';
import {
  DEFAULT_TIME_RANGE,
  TIME_RANGES,
  type TProjectOption,
  type TTimeRange,
} from '../lib/sessionFilters';
import { ProjectFilter } from './ProjectFilter';
import { TimeRangeFilter } from './TimeRangeFilter';

/** Resumen del proyecto cuando no hay ninguna marca (FR-003). */
const ALL_PROJECTS_LABEL = 'Todos';

/** Etiqueta de la acción que devuelve el listado a su estado sin filtrar (FR-012). */
const CLEAR_FILTERS_LABEL = 'Limpiar filtros';

/**
 * Nombre accesible de la acción de la barra. Incluye la etiqueta visible
 * ("Limpiar filtros", WCAG 2.5.3) pero la desambigua del botón homónimo que el
 * estado vacío de filtros (`EmptyScreenFilter`) muestra en la misma pantalla,
 * para que tecnologías de asistencia y tests distingan ambas acciones (FR-021).
 */
const CLEAR_FILTERS_ACCESSIBLE_NAME = 'Limpiar filtros de la barra';

/** Resumen del filtro de proyecto: `Todos`, `1 proyecto` o `N proyectos`. */
const projectsSummary = (count: number): string => {
  if (count === 0) return ALL_PROJECTS_LABEL;
  return count === 1 ? '1 proyecto' : `${count} proyectos`;
};

/** Etiqueta visible del rango activo (`Última hora`, `Todo`, …) (FR-007). */
const rangeSummary = (range: TTimeRange): string =>
  TIME_RANGES.find((option) => option.value === range)?.label ?? 'Todo';

interface SessionFilterBarProps {
  /** Catálogo de proyectos con al menos una sesión (FR-004), sin filtrar. */
  options: TProjectOption[];
  /** Directorios marcados; `[]` significa "todos" (FR-003). */
  selectedProjects: string[];
  /** Marca/desmarca un proyecto (multiselección, FR-002). */
  onToggleProject: (directory: string) => void;
  /** Rango temporal activo; `all` por defecto (FR-008). */
  range?: TTimeRange;
  /**
   * Notifica el rango elegido (FR-006, FR-007). Si no se aporta, el control
   * temporal no se monta: la barra solo cablea lo que la página le conecta.
   */
  onRangeChange?: (range: TTimeRange) => void;
  /** ¿Hay filtros activos? Habilita el resumen y la acción de limpiar (FR-025). */
  hasActiveFilters?: boolean;
  /** Limpia los filtros; se invoca desde la acción "Limpiar filtros" (FR-012). */
  onClear?: () => void;
}

/**
 * Barra de filtros del listado de sesiones (feature 005, FR-024).
 *
 * Fila **siempre visible** entre el título de la página y el listado, sin
 * tarjeta ni borde nuevo: solo `Container` con `row` / `justify="between"` y
 * separación por espaciado, coherente con el encabezado de grupo actual
 * (Design Direction del plan). Aloja el control de proyecto (`ProjectFilter`)
 * y, cuando la página cablea `onRangeChange`, el control temporal
 * (`TimeRangeFilter`, US2/T023).
 *
 * Mientras hay filtros activos (`hasActiveFilters`) muestra, sin expandir
 * nada, un **resumen** de lo seleccionado (`N proyectos · <etiqueta de rango>`)
 * y la acción **"Limpiar filtros"** (`Button variant="link"`) que delega en
 * `onClear` (FR-012, FR-025, SC-006). Sin filtros activos, el resumen y la
 * acción se omiten y los controles permanecen en su estado por defecto.
 *
 * Es presentación pura: no conoce la URL ni el estado de filtros; recibe la
 * selección y delega los cambios en `onToggleProject` / `onRangeChange` /
 * `onClear` (Principio V).
 */
export const SessionFilterBar = ({
  options,
  selectedProjects,
  onToggleProject,
  range = DEFAULT_TIME_RANGE,
  onRangeChange,
  hasActiveFilters = false,
  onClear,
}: SessionFilterBarProps) => (
  <Container
    row
    justify="between"
    align="center"
    space="small"
    data-testid="session-filter-bar"
  >
    <Container row align="center" space="small">
      <ProjectFilter
        options={options}
        selected={selectedProjects}
        onToggle={onToggleProject}
      />
      {onRangeChange ? (
        <TimeRangeFilter value={range} onChange={onRangeChange} />
      ) : null}
    </Container>
    {hasActiveFilters ? (
      <Container row align="center" space="small">
        <span
          className="text-[11px] uppercase tracking-wide text-muted-foreground"
        >
          {`${projectsSummary(selectedProjects.length)} · ${rangeSummary(range)}`}
        </span>
        <Button
          variant="link"
          onClick={onClear}
          aria-label={CLEAR_FILTERS_ACCESSIBLE_NAME}
        >
          {CLEAR_FILTERS_LABEL}
        </Button>
      </Container>
    ) : null}
  </Container>
);
