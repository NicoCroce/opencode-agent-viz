import { useCallback, useState } from 'react';
import {
  readStoredThreshold,
  writeStoredThreshold,
} from '@app/Application/Helpers/anomalyThreshold';
import { STORE_KEY, useGlobalStore } from './useGlobalStore';

export interface TAnomalyThreshold {
  /** Umbral vigente (±fracción), acotado a `(0.05, 0.95)`. */
  threshold: number;
  /** Cambia y persiste el umbral (FR-022); el valor se acota antes de guardar. */
  setThreshold: (value: number) => void;
}

/**
 * Preferencia de vista del umbral de anomalía de latencia (FR-022;
 * `latency-anomaly-contract` §4). Vive en el **store global** (TanStack Query,
 * patrón de `useGlobalStore`) porque la comparten dos capas que no deben
 * acoplarse: el enriquecimiento del grafo (marca en el nodo) y la sección de
 * latencia del detalle. El valor se persiste en `localStorage` a través de los
 * helpers puros de `Application/Helpers/anomalyThreshold`.
 *
 * Al cambiar el umbral, todos los consumidores del mismo key se re-renderizan:
 * el grafo recalcula `context.latency` (sus `anomalies`) y el detalle vuelve a
 * marcar la lista con la nueva sensibilidad (escenario 5 de US5).
 */
export const useAnomalyThreshold = (): TAnomalyThreshold => {
  const { data, setQueryData } = useGlobalStore<number>(
    STORE_KEY.anomalyThreshold,
  );

  // Sin valor en el store todavía, la fuente es `localStorage` (o el default).
  // La lectura inicial se memoiza una sola vez por montaje: en cada render
  // volver a leer `localStorage` era un efecto secundario innecesario.
  const [initialThreshold] = useState(readStoredThreshold);
  const threshold = data ?? initialThreshold;

  const setThreshold = useCallback(
    (value: number) => setQueryData(writeStoredThreshold(value)),
    [setQueryData],
  );

  return { threshold, setThreshold };
};
