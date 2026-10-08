import {
  DEFAULT_TIME_RANGE,
  TIME_RANGES,
  type TTimeRange,
} from './timeRange';

/**
 * Transporte de los filtros del listado de sesiones en la dirección de la
 * página (feature 005, FR-013..FR-015).
 *
 * Parseo tolerante: ante un valor desconocido o malformado se degrada sin
 * error visible, preservando el contrato §5 de la feature.
 */

/** Nombres de los parámetros de la URL que transportan los filtros (FR-013). */
export const FILTER_PARAM_KEYS = {
  projects: 'projects',
  range: 'range',
} as const;

/** Separador de directorios dentro del parámetro `projects`. */
const PROJECT_SEPARATOR = ',';

/**
 * Decodifica un segmento de la URL sin romper ante un `%` malformado: si
 * `decodeURIComponent` falla se conserva el segmento tal cual.
 */
const decodeProject = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Parsea el parámetro `projects`. Ausente o vacío → `[]` (que significa
 * "todos", FR-003). Cada segmento se decodifica de forma tolerante y los vacíos
 * se descartan (FR-015).
 */
export const parseProjects = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(PROJECT_SEPARATOR)
    .map(decodeProject)
    .filter((directory) => directory.length > 0);
};

/**
 * Serializa los directorios seleccionados. Sin selección → `undefined`, para
 * que el parámetro se elimine de la dirección (FR-013, US3 esc. 4).
 */
export const serializeProjects = (
  directories: readonly string[],
): string | undefined => {
  if (directories.length === 0) return undefined;
  return directories.map(encodeURIComponent).join(PROJECT_SEPARATOR);
};

/**
 * Parsea el parámetro `range`. Un valor desconocido o ausente se degrada al
 * rango por defecto `all`, sin error visible (FR-008, FR-015).
 */
export const parseTimeRange = (
  raw: string | null | undefined,
): TTimeRange => {
  const match = TIME_RANGES.find((option) => option.value === raw);
  return match ? match.value : DEFAULT_TIME_RANGE;
};

/**
 * Serializa el rango activo. `all` → `undefined`, para no ensuciar la dirección
 * con el valor por defecto (FR-013).
 */
export const serializeRange = (
  range: TTimeRange,
): TTimeRange | undefined => (range === DEFAULT_TIME_RANGE ? undefined : range);
