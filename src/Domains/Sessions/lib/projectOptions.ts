import { folderName } from '@app/Application/Helpers';
import type { TSessionGroup } from '../Hooks/useRootSessions';

/**
 * Catálogo de opciones de proyecto del filtro de multiselección y resumen del
 * disparador (feature 005, FR-004, FR-023).
 */

/** Opción de proyecto del filtro de multiselección (FR-004, FR-023). */
export interface TProjectOption {
  /** Clave estable del grupo (`group.directory`) y valor de URL. */
  directory: string;
  /** Nombre de la carpeta contenedora: etiqueta principal (FR-023). */
  name: string;
  /** Ruta completa: texto secundario para desambiguar homónimos (FR-023). */
  path: string;
  /** Nº de sesiones del proyecto en el catálogo sin filtrar (FR-004). */
  count: number;
}

/** Resumen del disparador cuando no hay ningún proyecto marcado (FR-003). */
export const ALL_PROJECTS_LABEL = 'Todos';

/** Resumen del disparador: `Todos` o el número de proyectos marcados. */
export const summarizeProjects = (count: number): string => {
  if (count === 0) return ALL_PROJECTS_LABEL;
  return count === 1 ? '1 proyecto' : `${count} proyectos`;
};

/**
 * Construye el catálogo de opciones a partir de los grupos **sin filtrar**:
 * solo proyectos con al menos una sesión, sin opciones vacías (FR-004), con el
 * nombre de carpeta como etiqueta principal y la ruta completa como secundaria
 * (FR-023). Se preserva el orden de los grupos.
 */
export const buildProjectOptions = (
  groups: readonly TSessionGroup[],
): TProjectOption[] =>
  groups
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      directory: group.directory,
      name: folderName(group.directory),
      path: group.directory,
      count: group.items.length,
    }));
