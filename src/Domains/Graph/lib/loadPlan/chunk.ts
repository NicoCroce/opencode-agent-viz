import { chunkArray } from '@app/Application/Helpers/array';

/**
 * Tamaño de lote por defecto de `chunkLoadPlan` (contrato de carga §2.2). Es una
 * constante exportada y ajustable: el hook de enriquecimiento puede pasar otro
 * tamaño, pero el valor por defecto acota el trabajo por turno para no congelar
 * la UI (SC-007).
 */
export const LOAD_CHUNK_SIZE = 8;

/**
 * Trocea `orderedIds` en lotes de `size` (contrato de carga §2.2). `size` por
 * defecto es `LOAD_CHUNK_SIZE`; `size <= 0` se normaliza a `1`; una entrada vacía
 * devuelve `[]`. La concatenación de los chunks es `orderedIds`, sin pérdidas ni
 * duplicados (L3). Función pura, sin React (Principio V).
 *
 * Delega el troceado genérico en `chunkArray` (`Application/Helpers/array.ts`).
 */
export const chunkLoadPlan = (
  orderedIds: readonly string[],
  size: number = LOAD_CHUNK_SIZE,
): string[][] => chunkArray(orderedIds, size);
