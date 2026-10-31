import { Button, Container } from '@app/Application/Components';
import {
  DEFAULT_TIME_RANGE,
  summarizeProjects,
  timeRangeLabel,
  type TProjectOption,
  type TTimeRange,
} from '../lib/sessionFilters';
import { ProjectFilter } from './ProjectFilter';
import { TimeRangeFilter } from './TimeRangeFilter';

/** Etiqueta de la acción que devuelve el listado a su estado sin filtrar (FR-012). */
const CLEAR_FILTERS_LABEL = 'Limpiar filtros';

/**
 * Nombre accesible de la acción de la barra. Incluye la etiqueta visible
 * ("Limpiar filtros", WCAG 2.5.3) pero la desambigua del botón homónimo que el
 * estado vacío de filtros (`EmptyScreenFilter`) muestra en la misma pantalla,
 * para que tecnologías de asistencia y tests distingan ambas acciones (FR-021).
 */
const CLEAR_FILTERS_ACCESSIBLE_NAME = 'Limpiar filtros de la barra';

/**
 * Piel de los controles de la barra (diseño "minimal-futurista"): 48px de alto,
 * `rounded-lg` sobre `surface-1` y borde de acento con `ring-glow` mientras el
 * desplegable está abierto. Los disparadores son moléculas compartidas sin
 * `className` propio (`MultiSelectFilterPopover`, `LabeledSelect`), así que la
 * piel se aplica por contexto a sus `<button>` (los popovers van en portal y no
 * se ven afectados).
 */
const FILTER_CONTROLS_CLASS = [
  '[&_button]:h-12 [&_button]:rounded-lg [&_button]:border-border [&_button]:bg-surface-1 [&_button]:px-4 [&_button]:text-[13px] [&_button]:shadow-none',
  '[&_button[aria-expanded=true]]:border-accent [&_button[aria-expanded=true]]:ring-glow',
].join(' ');

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
 * separación por espaciado (salta de línea en pantallas estrechas). Aloja,
 * en el orden del diseño, el control temporal (`TimeRangeFilter`, US2/T023,
 * solo si la página cablea `onRangeChange`) y el de proyecto (`ProjectFilter`).
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
    space="medium"
    className="flex-wrap"
    data-testid="session-filter-bar"
  >
    <Container
      row
      align="center"
      space="small"
      className={`flex-wrap ${FILTER_CONTROLS_CLASS}`}
    >
      {onRangeChange ? (
        <TimeRangeFilter value={range} onChange={onRangeChange} />
      ) : null}
      <ProjectFilter
        options={options}
        selected={selectedProjects}
        onToggle={onToggleProject}
      />
    </Container>
    {hasActiveFilters ? (
      <Container row align="center" space="small">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {`${summarizeProjects(selectedProjects.length)} · ${timeRangeLabel(range)}`}
        </span>
        <Button
          variant="link"
          onClick={onClear}
          aria-label={CLEAR_FILTERS_ACCESSIBLE_NAME}
          className="text-accent"
        >
          {CLEAR_FILTERS_LABEL}
        </Button>
      </Container>
    ) : null}
  </Container>
);
