/**
 * Umbral de anomalía de latencia (FR-022; `latency-anomaly-contract` §5). Una
 * respuesta se marca lenta cuando su generación supera `(1 + threshold) ×` lo
 * esperado para su modelo y sus tokens (y el exceso llega a `MIN_EXCESS_MS`).
 *
 * Vive en `Application` (capa base) porque es una **preferencia de vista**
 * compartida por el grafo (marca en el nodo) y el panel de detalle (sección de
 * latencia): así ninguna de las dos capas importa a la otra.
 */

/** Umbral por defecto: +100 %, el doble de lo esperado. */
export const DEFAULT_ANOMALY_THRESHOLD = 1;

/**
 * Clave de `localStorage` del umbral configurable (patrón de `useInspectorPanel`).
 * Es nueva porque el umbral cambió de significado: antes era ±fracción sobre la
 * mediana del total; un valor guardado con el criterio anterior no aplica.
 */
export const ANOMALY_THRESHOLD_STORAGE_KEY = 'opencode-agent-viz:latency-threshold';

/** Límite inferior del rango válido: +25 %. */
export const MIN_ANOMALY_THRESHOLD = 0.25;

/** Límite superior del rango válido: +300 % (4× lo esperado). */
export const MAX_ANOMALY_THRESHOLD = 3;

/**
 * Acota el umbral a `[0.25, 3]` y cae al default ante un valor no finito
 * (`NaN`/`Infinity`). Función pura (Principio V).
 */
export const clampThreshold = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_ANOMALY_THRESHOLD, Math.max(MIN_ANOMALY_THRESHOLD, value))
    : DEFAULT_ANOMALY_THRESHOLD;

/**
 * Lee el umbral persistido, acotado; sin valor guardado o no parseable, el
 * default. Tolerante a entornos sin `localStorage` (SSR/tests).
 */
export const readStoredThreshold = (): number => {
  try {
    const raw = globalThis.localStorage?.getItem(ANOMALY_THRESHOLD_STORAGE_KEY);
    if (raw === null || raw === undefined) return DEFAULT_ANOMALY_THRESHOLD;
    return clampThreshold(Number(raw));
  } catch {
    return DEFAULT_ANOMALY_THRESHOLD;
  }
};

/** Persiste el umbral ya acotado. Tolerante a entornos sin `localStorage`. */
export const writeStoredThreshold = (value: number): number => {
  const clamped = clampThreshold(value);
  try {
    globalThis.localStorage?.setItem(
      ANOMALY_THRESHOLD_STORAGE_KEY,
      String(clamped),
    );
  } catch {
    // Sin almacenamiento el umbral sigue vigente en memoria.
  }
  return clamped;
};
