import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PERF_METRIC,
  perfMark,
  perfMeasure,
  type TPerfMetricName,
} from '@app/Application/Helpers';
import { queryKeys } from '@app/Domains/queryKeys';

interface UseSessionOpenPerfParams {
  id: string | null;
  directory: string | null;
  isLoading: boolean;
  isError: boolean;
  nodeCount: number;
}

/**
 * Instrumentación de apertura/revisita (FR-011, contrato de instrumentación
 * §4): al cambiar de sesión se decide la medida según si la **estructura** del
 * subárbol ya estaba en el caché de consultas (`graph.session.open` si no,
 * `graph.session.revisit` si sí). La medida se registra cuando el grafo tiene
 * nodos, es decir, cuando la estructura está disponible.
 *
 * La prueba de "estructura ya cacheada" mira la key nueva del subárbol
 * (`queryKeys.graph.for(directory, sessionId)`), que es donde
 * `useGraphStructure` guarda el resultado del cargador desde `011` (contrato de
 * subárbol §3): la key vieja del listado global (`sessions.list`) ya no se
 * puebla, por lo que la métrica quedaría fija en `0`.
 */
export const useSessionOpenPerf = ({
  id,
  directory,
  isLoading,
  isError,
  nodeCount,
}: UseSessionOpenPerfParams): void => {
  const queryClient = useQueryClient();
  const pendingSessionPerf = useRef<TPerfMetricName | null>(null);

  useEffect(() => {
    if (!id || !directory) {
      pendingSessionPerf.current = null;
      return;
    }
    const cached =
      queryClient.getQueryData(queryKeys.graph.for(directory, id)) !== undefined;
    const metric = cached
      ? PERF_METRIC.sessionRevisit
      : PERF_METRIC.sessionOpen;
    pendingSessionPerf.current = metric;
    perfMark(`${metric}.start`);
  }, [id, directory, queryClient]);

  useEffect(() => {
    const metric = pendingSessionPerf.current;
    if (!metric || isLoading || isError) return;
    if (nodeCount === 0) return;
    perfMeasure(metric, `${metric}.start`, {
      nodeCount,
      phase: metric === PERF_METRIC.sessionOpen ? 'structure' : 'cache',
    });
    pendingSessionPerf.current = null;
  }, [isLoading, isError, nodeCount]);
};
