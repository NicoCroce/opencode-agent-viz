/**
 * Umbrales normativos del motor de eficiencia de sesión.
 *
 * Fuente: `contracts/efficiency-engine-contract.md` §5–§7 y `data-model.md` §4.
 * Ningún módulo del dominio debe declarar estos números por su cuenta: todos los
 * valores del cálculo viven aquí y se importan desde este archivo.
 */

/** Pesos de dimensión; suman 100. */
export const DIMENSION_WEIGHTS = {
  entrada: 30,
  ejecucion: 30,
  contexto: 15,
  resultado: 25,
} as const;

/** Pesos relativos de los indicadores; suman 1 por dimensión. */
export const INDICATOR_WEIGHTS = {
  entrada: { 'INP-1': 0.45, 'INP-2': 0.35, 'INP-3': 0.2 },
  ejecucion: { 'RES-1': 0.45, 'RES-2': 0.35, 'RES-3': 0.2 },
  contexto: { 'RES-4': 0.7, CACHE: 0.3 },
  resultado: { OUTCOME: 0.7, OPEN_ERRORS: 0.3 },
} as const;

/** Tope de tolerancia (`cap`) de cada indicador; siempre > 0. */
export const INDICATOR_CAPS = {
  'INP-1': 0.5,
  'INP-2': 0.33,
  'INP-3': 1,
  'RES-1': 0.2,
  'RES-2': 0.1,
  'RES-3': 0.15,
  'RES-4': 2,
  CACHE: 0.6,
  OUTCOME: 1,
  OPEN_ERRORS: 1,
} as const;

/** Mínimo de muestra por indicador; 0 = sin mínimo. */
export const INDICATOR_MINIMUMS = {
  'INP-1': 3,
  'INP-2': 0,
  'INP-3': 0,
  'RES-1': 10,
  'RES-2': 0,
  'RES-3': 0,
  'RES-4': 0,
  CACHE: 10,
  OUTCOME: 1,
  OPEN_ERRORS: 0,
} as const;

/** Pasos mínimos (raíz + subárbol) para que Ejecución esté disponible (RES-1). */
export const EXECUTION_MIN_STEPS = 5;

/** Pares consecutivos con similitud ≥ este valor cuentan para INP-1. */
export const SIMILARITY_THRESHOLD = 0.6;

/** Similitud mínima para considerar repetida una pregunta (INP-3, research R4). */
export const QUESTION_REPEAT_SIMILARITY = 0.7;

/** Tokens mínimos de cada prompt de un par elegible (INP-1). */
export const MIN_PROMPT_TOKENS = 6;

/** Turnos cerrados mínimos para puntuar; con menos, `insufficient`. */
export const MIN_CLOSED_TURNS = 2;

/** `coverage` por debajo de este valor ⇒ `insufficient`. */
export const MIN_COVERAGE = 60;

/** Cobertura mínima para confianza `alta` (con el doble de los mínimos de muestra). */
export const HIGH_CONFIDENCE_MIN_COVERAGE = 85;

/** Cobertura mínima para confianza `media`. */
export const MEDIUM_CONFIDENCE_MIN_COVERAGE = 70;

/** Puntos de cobertura que se pierden si Contexto está disponible y la caché se omite (4,5). */
export const CACHE_OMISSION_PENALTY =
  DIMENSION_WEIGHTS.contexto * INDICATOR_WEIGHTS.contexto.CACHE;

/** Nota mínima de cada banda; `friccion` cubre el resto. */
export const BAND_MINIMUMS = {
  eficiente: 85,
  aceptable: 70,
  mejorable: 50,
  friccion: 0,
} as const;

/** Desde este número de intentos (`attempt`) o reintentos se emite RES-2. */
export const RETRY_ALERT_THRESHOLD = 3;

/** Nº de tools lentas (≥ `SLOW_TOOL_MS`) que dispara RES-6 aunque el p95 no lo haga. */
export const SLOW_TOOL_MIN_CALLS = 3;

/** Máximo de factores que muestra el veredicto. */
export const MAX_FACTORS = 3;

/** Recorte de prompts y citas en la vista, en code points. */
export const PROMPT_TRUNCATE_CODE_POINTS = 120;

/** Duración a partir de la cual una tool se considera lenta. */
export const SLOW_TOOL_MS = 60_000;

/** Máximo de hallazgos penalizantes en `findings`. */
export const MAX_FINDINGS = 10;

/** Máximo de señales débiles en `weakSignals`. */
export const MAX_WEAK_SIGNALS = 10;
