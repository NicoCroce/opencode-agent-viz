import { useCallback, useMemo } from 'react';
import { useURLParams } from '@app/Application/Hooks';
import {
  DEFAULT_TIME_RANGE,
  FILTER_PARAM_KEYS,
  buildProjectOptions,
  filterGroups,
  parseProjects,
  parseTimeRange,
  serializeProjects,
  serializeRange,
  type TProjectOption,
  type TTimeRange,
} from '../lib/sessionFilters';
import type { TSessionGroup } from './useRootSessions';
import { useNow } from './useNow';

/** Parámetros de la dirección que transportan el estado de los filtros. */
interface SessionFilterParams extends Record<string, string | number> {
  projects: string;
  range: string;
}

/** Estado y handlers que la página del listado consume de `useSessionFilters`. */
export interface TUseSessionFiltersResult {
  /** Catálogo de proyectos con al menos una sesión (FR-004), sin filtrar. */
  options: TProjectOption[];
  /** Directorios tal como llegan en la URL; puede incluir proyectos inexistentes. */
  selectedProjects: string[];
  /** Intersección con el catálogo; es la selección realmente aplicada (FR-015). */
  validSelected: string[];
  /** Rango temporal activo; `all` por defecto (FR-008). */
  range: TTimeRange;
  /** ¿Hay algún filtro aplicado? (proyecto válido o rango ≠ `all`). */
  hasActiveFilters: boolean;
  /** Grupos con la intersección proyecto × rango aplicada (FR-010, FR-017). */
  filteredGroups: TSessionGroup[];
  /** ¿El resultado filtrado no tiene sesiones? (solo relevante con filtros activos). */
  isEmptyResult: boolean;
  /** Marca/desmarca un proyecto (multiselección, FR-002, FR-003). */
  toggleProject: (directory: string) => void;
  /** Cambia el rango temporal; `all` elimina el parámetro de la URL (FR-008). */
  setRange: (range: TTimeRange) => void;
  /** Elimina ambos filtros de la dirección, sin borrar otros parámetros (FR-012). */
  clearFilters: () => void;
}

/**
 * Estado de los filtros del listado de sesiones (feature 005).
 *
 * Recibe los `groups` **ya calculados** por la página (que es la única que llama
 * a `useRootSessions`): este hook no suscribe ni re-consulta datos, solo deriva
 * estado de vista. La dirección de la página es la **única fuente de estado**
 * (R1): `projects` y `range` se leen/escriben vía `useURLParams`, de modo que
 * recargar o compartir el enlace reproduce la misma selección (FR-013, FR-014).
 *
 * Un rango acotado activa el reloj en vivo (`useNow`) para recomponer la lista
 * por el mero paso del tiempo sin recargar (FR-022, SC-007); con `all` el tick
 * se desactiva y no hay re-renders innecesarios.
 *
 * @param groups - Grupos de sesiones raíz ya calculados por `useRootSessions`.
 */
export const useSessionFilters = (
  groups: TSessionGroup[],
): TUseSessionFiltersResult => {
  const { getParam, updateParams } = useURLParams<SessionFilterParams>();

  const selectedProjects = useMemo(
    () => parseProjects(getParam(FILTER_PARAM_KEYS.projects)),
    [getParam],
  );

  const range = useMemo(
    () => parseTimeRange(getParam(FILTER_PARAM_KEYS.range)),
    [getParam],
  );

  // Catálogo de proyectos del estado sin filtrar: no hay opciones vacías (FR-004).
  const options = useMemo(() => buildProjectOptions(groups), [groups]);

  // Un proyecto que ya no existe se ignora; si la intersección queda vacía se
  // comporta como "todos" (FR-003, FR-015).
  const validSelected = useMemo(() => {
    const available = new Set(options.map((option) => option.directory));
    return selectedProjects.filter((directory) => available.has(directory));
  }, [options, selectedProjects]);

  const hasActiveFilters =
    validSelected.length > 0 || range !== DEFAULT_TIME_RANGE;

  const now = useNow(range !== DEFAULT_TIME_RANGE);

  const filteredGroups = useMemo(
    () => filterGroups(groups, { directories: validSelected, range, now }),
    [groups, validSelected, range, now],
  );

  const isEmptyResult = filteredGroups.length === 0;

  const toggleProject = useCallback(
    (directory: string) => {
      const next = validSelected.includes(directory)
        ? validSelected.filter((selected) => selected !== directory)
        : [...validSelected, directory];
      updateParams({ [FILTER_PARAM_KEYS.projects]: serializeProjects(next) });
    },
    [updateParams, validSelected],
  );

  const setRange = useCallback(
    (nextRange: TTimeRange) => {
      updateParams({ [FILTER_PARAM_KEYS.range]: serializeRange(nextRange) });
    },
    [updateParams],
  );

  // Borra solo los parámetros de filtro; nunca `clearParams`, que eliminaría
  // cualquier otro parámetro de la dirección (FR-012).
  const clearFilters = useCallback(() => {
    updateParams({
      [FILTER_PARAM_KEYS.projects]: undefined,
      [FILTER_PARAM_KEYS.range]: undefined,
    });
  }, [updateParams]);

  return {
    options,
    selectedProjects,
    validSelected,
    range,
    hasActiveFilters,
    filteredGroups,
    isEmptyResult,
    toggleProject,
    setRange,
    clearFilters,
  };
};
