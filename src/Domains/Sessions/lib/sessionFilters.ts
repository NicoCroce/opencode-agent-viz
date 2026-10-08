import { folderName } from '@app/Application/Helpers';
import type { TSessionGroup } from '../Hooks/useRootSessions';

/**
 * Lógica pura de los filtros del listado de sesiones (feature 005).
 *
 * Concentra el parseo/serialización de la URL, la evaluación del rango temporal
 * sobre la última actividad (`time.updated`, FR-009), la intersección
 * proyecto × rango y la construcción de opciones de proyecto. No depende del
 * SDK en runtime ni del reloj real: `now` siempre se inyecta, de modo que la
 * ventana rodante (FR-022) es testeable sin temporizadores.
 */

/* ------------------------------------------------------------------ */
/* View-models (estado de vista, no entidades del servidor)            */
/* ------------------------------------------------------------------ */

/** Rangos temporales predefinidos; conjunto cerrado y conocido (FR-007). */
export type TTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

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

/** Selección de filtros reflejada en la dirección de la página (FR-013). */
export interface TSessionFilters {
  /** Directorios marcados; `[]` significa "todos" (FR-003). */
  projects: string[];
  /** Rango temporal activo; por defecto `all` (FR-008). */
  range: TTimeRange;
}

/** Entrada de la tabla de rangos que alimenta el control temporal. */
export interface TTimeRangeOption {
  value: TTimeRange;
  label: string;
  /** Duración de la ventana en ms; `null` = sin corte ("todo"). */
  durationMs: number | null;
}

/** Opciones de `filterGroups`: proyecto × rango × instante de referencia. */
export interface TFilterGroupsOptions {
  /** Directorios seleccionados; vacío = sin filtro de proyecto (FR-003). */
  directories: readonly string[];
  range: TTimeRange;
  /** Instante contra el que se evalúa la ventana rodante (FR-022). */
  now: number;
}

/* ------------------------------------------------------------------ */
/* Constantes (sin magic strings)                                      */
/* ------------------------------------------------------------------ */

/** Rango por defecto y valor "sin corte" (FR-008). */
export const DEFAULT_TIME_RANGE: TTimeRange = 'all';

/** Rangos predefinidos con su etiqueta visible y duración (FR-007). */
export const TIME_RANGES: readonly TTimeRangeOption[] = [
  { value: '1h', label: 'Última hora', durationMs: 3_600_000 },
  { value: '24h', label: 'Últimas 24 horas', durationMs: 86_400_000 },
  { value: '7d', label: 'Últimos 7 días', durationMs: 604_800_000 },
  { value: '30d', label: 'Últimos 30 días', durationMs: 2_592_000_000 },
  { value: DEFAULT_TIME_RANGE, label: 'Todo', durationMs: null },
];

/** Nombres de los parámetros de la URL que transportan los filtros (FR-013). */
export const FILTER_PARAM_KEYS = {
  projects: 'projects',
  range: 'range',
} as const;

/** Separador de directorios dentro del parámetro `projects`. */
const PROJECT_SEPARATOR = ',';

/* ------------------------------------------------------------------ */
/* URL: parseo y serialización tolerantes (FR-013..FR-015)             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Evaluación de rango e intersección (FR-005, FR-009, FR-010, FR-017) */
/* ------------------------------------------------------------------ */

/** Duración de la ventana de un rango; `null` para `all` (sin corte). */
const durationFor = (range: TTimeRange): number | null =>
  TIME_RANGES.find((option) => option.value === range)?.durationMs ?? null;

/**
 * ¿La última actividad `updatedAt` cae dentro de la ventana `range`?
 *
 * - `all` → siempre `true` (sin corte).
 * - `updatedAt` no finito (`null`/`undefined`/`NaN`) → `false` para cualquier
 *   rango acotado (edge case "sesión sin actividad registrada").
 * - En otro caso → `now - updatedAt <= durationMs` (frontera incluida).
 */
export const isWithinTimeRange = (
  updatedAt: number | null | undefined,
  range: TTimeRange,
  now: number,
): boolean => {
  if (range === DEFAULT_TIME_RANGE) return true;
  const durationMs = durationFor(range);
  if (durationMs === null) return true;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return false;
  return now - updatedAt <= durationMs;
};

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

/* ------------------------------------------------------------------ */
/* Opciones de proyecto (FR-004, FR-023)                               */
/* ------------------------------------------------------------------ */

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
