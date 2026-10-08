/**
 * Trocea `items` en lotes de `size`, conservando el orden y sin pérdidas ni
 * duplicados: la concatenación de los chunks es `items`. Un `size` no finito o
 * `< 1` (incluido el rango fraccional `0 < size < 1`, que truncaría a `0`) se
 * normaliza a `1`, y una entrada vacía devuelve `[]`.
 *
 * Extraído de `loadPriority.chunkLoadPlan` (que además aplica `LOAD_CHUNK_SIZE`
 * por defecto); aquí no hay tamaño implícito, el llamador siempre lo decide.
 */
export const chunkArray = <T>(items: readonly T[], size: number): T[][] => {
  if (items.length === 0) return [];

  const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};
