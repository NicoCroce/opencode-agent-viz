import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { scheduleIdle } from '@app/Application/Helpers/scheduleIdle';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import { useGetSessionStatus } from '../../Sessions/Sessions.service';
import type { TGraphModel } from '../Graph.entity';
import { buildEnrichmentPlan } from '../lib/buildEnrichmentPlan';
import { enrichNodeData, readNodeEnrichmentInput } from '../lib/enrichNodeData';
import {
  deriveInvocationBatches,
  deriveInvocations,
  type TInvocation,
  type TInvocationBatch,
} from '../lib/invocations';
import { loadNodeContent } from '../lib/loadNodeContent';
import { chunkLoadPlan } from '../lib/loadPriority';
import { mergeEnrichedNodes } from '../lib/mergeEnrichedNodes';
import { DEFAULT_ANOMALY_THRESHOLD } from '../lib/metrics/anomalyThreshold';
import { deriveModelPaces } from '../lib/metrics/modelPace';
import { collectReadyIds } from '../lib/readyNodeIds';

/**
 * Enriquecimiento progresivo del subárbol (contrato de carga §1.2/§2-§3,
 * L5..L6): un lote por turno de idle (`scheduleIdle`, SC-007) sobre el plan puro
 * `buildEnrichmentPlan`; escribe en las **mismas claves** que parchea
 * `eventReducer` (FR-009, R6) y marca `enrichment: 'ready'` los nodos cargados.
 *
 * El cómputo puro vive en `lib/`: `collectReadyIds` (T024), `deriveModelPaces`
 * (T025) y `mergeEnrichedNodes` (T026); aquí quedan el estado de progreso, la
 * orquestación de lotes y la fusión de cada nodo (`enrichNodeData`). Un cambio
 * de `ids`/`structure` reinicia el plan en vuelo sin bloquear al nuevo (L6).
 */

/** Set vacío compartido: identidad estable para el estado "sin progreso". */
const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/** Progreso de enriquecimiento ligado a la firma del subárbol actual (L6). */
interface TEnrichmentProgress {
  signature: string;
  ids: ReadonlySet<string>;
}

/** Predicado de caché de `collectReadyIds`: la clave que escribe la siembra. */
const hasMessagesInCache = (queryClient: QueryClient, id: string): boolean =>
  queryClient.getQueryData(queryKeys.sessions.messages(id)) !== undefined;

export const useGraphEnrichment = (
  ids: string[],
  structure: TGraphModel,
  threshold: number = DEFAULT_ANOMALY_THRESHOLD,
): TGraphModel => {
  const queryClient = useQueryClient();
  const statusQuery = useGetSessionStatus();

  // Reloj estable: el tick en vivo lo resuelve `useGraphModel` (US3).
  const [now] = useState(() => Date.now());

  const signature = ids.join('\u0000');
  const [progress, setProgress] = useState<TEnrichmentProgress>(() => ({
    signature,
    ids: EMPTY_IDS,
  }));

  // Un cambio de firma descarta el progreso del plan anterior (L6).
  const enriched = progress.signature === signature ? progress.ids : EMPTY_IDS;

  // Enriquecido en esta visita ∪ lo que ya está en caché (FR-004/SC-008).
  const readyIds = useMemo(
    () =>
      collectReadyIds(ids, enriched, (id) =>
        hasMessagesInCache(queryClient, id),
      ),
    [enriched, ids, queryClient],
  );

  const plan = useMemo(
    () => buildEnrichmentPlan(structure, ids, readyIds),
    [structure, ids, readyIds],
  );

  // Ritmo de generación por modelo con todos los nodos listos (FR-020),
  // memoizado por identidad de la estructura/ready set: es la referencia para
  // decidir si una respuesta tardó más de lo esperado para sus tokens.
  const paces = useMemo(() => {
    const lists: TSessionMessage[][] = [];
    for (const node of structure.nodes) {
      if (!readyIds.has(node.id)) continue;
      lists.push(
        queryClient.getQueryData<TSessionMessage[]>(
          queryKeys.sessions.messages(node.id),
        ) ?? [],
      );
    }
    return deriveModelPaces(lists);
  }, [structure.nodes, readyIds, queryClient]);

  // Un turno de idle por lote; al cambiar `plan` el turno en vuelo se cancela y
  // el subárbol nuevo arranca de cero (L6).
  useEffect(() => {
    const chunk = chunkLoadPlan(plan.orderedIds)[0];
    if (!chunk) return;

    let cancelled = false;
    const idle = scheduleIdle(() => {
      void (async () => {
        try {
          await Promise.all(chunk.map((id) => loadNodeContent(queryClient, id)));
        } catch {
          // Fallo de red ⇒ el lote queda `pending` (contrato de carga §3).
          return;
        }
        if (cancelled) return;
        setProgress((prev) => {
          const base =
            prev.signature === signature ? new Set(prev.ids) : new Set<string>();
          for (const id of chunk) base.add(id);
          return { signature, ids: base };
        });
      })();
    });

    return () => {
      cancelled = true;
      idle.cancel();
    };
  }, [plan, queryClient, signature]);

  // El recorrido y la preservación de referencias de los no-listos son de
  // `mergeEnrichedNodes` (T026/FR-013, SC-006); la fusión por nodo sigue aquí.
  return useMemo<TGraphModel>(() => {
    const statuses = statusQuery.data ?? {};
    return mergeEnrichedNodes(structure, readyIds, (node) =>
      enrichNodeData({
        node,
        ...readNodeEnrichmentInput(queryClient, node.id),
        sessionStatus: statuses[node.id],
        now,
        threshold,
        paces,
      }),
    );
  }, [
    structure,
    readyIds,
    statusQuery.data,
    queryClient,
    now,
    threshold,
    paces,
  ]);
};

/** Marca de `sessions.messages(id)` por padre, en orden estable (L9/R6). */
const messagesIdentity = (
  queryClient: QueryClient,
  parentIds: string[],
): string =>
  parentIds
    .map(
      (id) =>
        `${id}:${
          queryClient.getQueryState(queryKeys.sessions.messages(id))
            ?.dataUpdatedAt ?? 0
        }`,
    )
    .join('|');

/**
 * `useInvocationBatches(structure)` — lotes por **invocación** del padre (FR-007
 * de 011; `invocation-lanes` §1), sin consultas nuevas: lee de caché
 * `sessions.messages(id)` (la clave de esta fase, FR-009) y solo mira los
 * padres. Memoizada por identidad de mensajes (T039): el tick de 1 s no
 * re-deriva y, al llegar los mensajes del padre, cambia la clave de ejecución
 * (`deriveExecutionKey`, R8). Sin mensajes del padre manda el respaldo
 * estructural por solape de sesión (FR-012).
 */
export const useInvocationBatches = (
  structure: TGraphModel,
): TInvocationBatch[] => {
  const queryClient = useQueryClient();

  // Sesiones padre con al menos un hijo en el subárbol, en orden estable.
  const parentIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const edge of structure.edges) {
      if (seen.has(edge.source)) continue;
      seen.add(edge.source);
      ids.push(edge.source);
    }
    return ids;
  }, [structure.edges]);

  const identity = messagesIdentity(queryClient, parentIds);

  return useMemo(
    // El memo se rige por `identity` (T039); mismo patrón que el plan por
    // `deriveExecutionKey` en `useGraphModel` (R4/R8).
    () => {
      const batches: TInvocationBatch[] = [];
      for (const id of parentIds) {
        const messages = queryClient.getQueryData<TSessionMessage[]>(
          queryKeys.sessions.messages(id),
        );
        if (messages === undefined) continue;
        const invocations: TInvocation[] = deriveInvocations(messages);
        batches.push(...deriveInvocationBatches(invocations, id));
      }
      return batches;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la clave es la identidad de mensajes (T039)
    [identity],
  );
};
