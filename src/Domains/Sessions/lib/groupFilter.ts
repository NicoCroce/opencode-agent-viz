import type { TSessionGroup } from '../Hooks/useRootSessions';
import { isWithinTimeRange, type TTimeRange } from './timeRange';

/**
 * Intersección proyecto × rango sobre los grupos de sesiones (feature 005,
 * FR-003, FR-005, FR-010, FR-017, FR-020).
 */

/** Selección de filtros reflejada en la dirección de la página (FR-013). */
export interface TSessionFilters {
  /** Directorios marcados; `[]` significa "todos" (FR-003). */
  projects: string[];
  /** Rango temporal activo; por defecto `all` (FR-008). */
  range: TTimeRange;
}

/** Opciones de `filterGroups`: proyecto × rango × instante de referencia. */
export interface TFilterGroupsOptions {
  /** Directorios seleccionados; vacío = sin filtro de proyecto (FR-003). */
  directories: readonly string[];
  range: TTimeRange;
  /** Instante contra el que se evalúa la ventana rodante (FR-022). */
  now: number;
}

/**
 * Aplica la intersección proyecto × rango sobre los grupos ya calculados.
 *
 * - `directories` vacío → sin filtro de proyecto (todos, FR-003).
 * - Un grupo fuera de `directories` se descarta entero (FR-005).
 * - Se conservan solo los items dentro del rango (FR-010).
 * - Un grupo sin items se descarta por completo, encabezado incluido (FR-017).
 * - Se preserva el orden de entrada de grupos e items (FR-020).
 */
export const filterGroups = (
  groups: readonly TSessionGroup[],
  { directories, range, now }: TFilterGroupsOptions,
): TSessionGroup[] => {
  const hasProjectFilter = directories.length > 0;
  const selected = new Set(directories);
  const result: TSessionGroup[] = [];

  for (const group of groups) {
    if (hasProjectFilter && !selected.has(group.directory)) continue;

    const items = group.items.filter((item) =>
      isWithinTimeRange(item.session.time.updated, range, now),
    );
    if (items.length === 0) continue;

    result.push({ directory: group.directory, items });
  }

  return result;
};
