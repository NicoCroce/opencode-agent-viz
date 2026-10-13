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
import { DEFAULT_ANOMALY_THRESHOLD } from '../lib/metrics/anomalyThreshold';
import { deriveLatency, median } from '../lib/metrics/latency';

/**
 * `useGraphEnrichment(ids, structure)` — segunda fase del modelo por fases
 * (contrato de carga §1.2, §2-§3; criterios L5..L6):
 *
 * - Consume el plan puro `buildEnrichmentPlan` (T016) y carga el contenido del
 *   subárbol **por lotes priorizados**, un lote por turno de idle
 *   (`scheduleIdle`, SC-007).
 * - Escribe en las **mismas claves** que parchea `eventReducer` (FR-009, R6).
 * - Fusiona métricas/estado final en los nodos ya cargados y los marca
 *   `enrichment: 'ready'`; el resto permanece `'pending'` (data-model §2.2).
 * - Al cambiar `ids`/`structure` (sesión nueva) el plan en vuelo se **reinicia**:
 *   los resultados del plan abandonado igual se escriben en caché (válidos y
 *   reutilizables, FR-004), pero no bloquean al nuevo (L6).
 *
 * El cómputo puro vive en `lib/` (`buildEnrichmentPlan`, `enrichNodeData`,
 * `loadNodeContent`); aquí queda el estado de progreso y la orquestación.
 */

/** Set vacío compartido: identidad estable para el estado "sin progreso". */
const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/** Progreso de enriquecimiento ligado a la firma del subárbol actual (L6). */
interface TEnrichmentProgress {
  signature: string;
  ids: ReadonlySet<string>;
}

export const useGraphEnrichment = (
  ids: string[],
  structure: TGraphModel,
  threshold: number = DEFAULT_ANOMALY_THRESHOLD,
): TGraphModel => {
  const queryClient = useQueryClient();
  const statusQuery = useGetSessionStatus();

  // Reloj estable de la fase de enriquecimiento: el tick en vivo lo resuelve
  // `useGraphModel` (US3); aquí solo se resuelve `durationMs` al completar cada
  // lote (data-model §2.1).
  const [now] = useState(() => Date.now());

  const signature = ids.join('\u0000');
  const [progress, setProgress] = useState<TEnrichmentProgress>(() => ({
    signature,
    ids: EMPTY_IDS,
  }));

  // Al cambiar el subárbol, el progreso del plan anterior no aplica (L6): se
  // selecciona el set vacío si la firma no coincide.
  const enriched = progress.signature === signature ? progress.ids : EMPTY_IDS;

  // `readyIds` = lo ya procesado en esta visita ∪ lo que ya está en caché (una
  // revisita no repite trabajo, FR-004/SC-008). El plan excluye esos ids.
  const readyIds = useMemo(() => {
    const set = new Set<string>(enriched);
    for (const id of ids) {
      if (
        queryClient.getQueryData(queryKeys.sessions.messages(id)) !== undefined
      ) {
        set.add(id);
      }
    }
    return set;
  }, [enriched, ids, queryClient]);

  const plan = useMemo(
    () => buildEnrichmentPlan(structure, ids, readyIds),
    [structure, ids, readyIds],
  );

  // Mediana de `totalMs` por agente (FR-020): referencia de respaldo para los
  // nodos con menos de `MIN_SAMPLES` muestras propias. Se calcula sobre los
  // nodos ya enriquecidos (sus mensajes están en caché) y se memoiza por
  // identidad de la estructura/ready set; no se recalcula por tick.
  const agentMedianByAgent = useMemo(() => {
    const totalsByAgent = new Map<string, number[]>();
    for (const node of structure.nodes) {
      if (!readyIds.has(node.id)) continue;
      const messages =
        queryClient.getQueryData<TSessionMessage[]>(
          queryKeys.sessions.messages(node.id),
        ) ?? [];
      const agent = node.data.agentName;
      const totals = totalsByAgent.get(agent) ?? [];
      for (const sample of deriveLatency(messages).samples) {
        if (sample.totalMs !== null) totals.push(sample.totalMs);
      }
      totalsByAgent.set(agent, totals);
    }

    const medians: Record<string, number | null> = {};
    for (const [agent, totals] of totalsByAgent) {
      medians[agent] = median(totals);
    }
    return medians;
  }, [structure.nodes, readyIds, queryClient]);

  // Un turno de idle por lote: carga el primer chunk pendiente, escribe la caché
  // y marca esos ids como procesados. Al reiniciarse el plan (cambia `plan`) el
  // turno en vuelo se cancela y el nuevo subárbol arranca de cero (L6).
  useEffect(() => {
    const chunk = chunkLoadPlan(plan.orderedIds)[0];
    if (!chunk) return;

    let cancelled = false;
    const idle = scheduleIdle(() => {
      void (async () => {
        try {
          await Promise.all(chunk.map((id) => loadNodeContent(queryClient, id)));
        } catch {
          // Un fallo de red deja el lote en `pending` (contrato de carga §3):
          // el estado de pantalla lo gobierna `sessionsQuery` (FR-008).
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

  return useMemo<TGraphModel>(() => {
    const statuses = statusQuery.data ?? {};
    const nodes = structure.nodes.map((node) =>
      readyIds.has(node.id)
        ? {
            ...node,
            data: enrichNodeData({
              node,
              ...readNodeEnrichmentInput(queryClient, node.id),
              sessionStatus: statuses[node.id],
              now,
              threshold,
              agentMedianMs: agentMedianByAgent[node.data.agentName] ?? null,
            }),
          }
        : node,
    );
    return { nodes, edges: structure.edges };
  }, [
    structure,
    readyIds,
    statusQuery.data,
    queryClient,
    now,
    threshold,
    agentMedianByAgent,
  ]);
};

/**
 * Identidad de los mensajes de los padres: la marca de actualización de
 * `sessions.messages(id)` —la **misma** clave que escribe el enriquecimiento y
 * que parchea `eventReducer` (L9/R6, FR-009)— por cada padre, en orden estable.
 * Cambia con cualquier evento en vivo o siembra de contenido, sin abrir ninguna
 * consulta.
 */
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
 * `useInvocationBatches(structure)` — lotes por **invocación** del padre (la
 * unidad de paralelismo, FR-007 de 011; contrato `invocation-lanes` §1):
 *
 * - **Sin consultas nuevas**: lee `sessions.messages(id)` de la caché, la misma
 *   clave que carga esta fase y que parchea el reducer de eventos (FR-009).
 * - Solo mira los **padres** (nodos con hijos): son los únicos que emiten
 *   invocaciones de subagente (Principio VII).
 * - **Memoizada por `(sessionId, identidad de mensajes)`** (T039): el memo se
 *   invalida con la marca de cada clave padre, así que al llegar los mensajes
 *   del padre aparecen los lotes y con ellos cambia la clave de ejecución
 *   (`deriveExecutionKey`, R8) — sin ese cambio de clave, el arreglo del
 *   paralelismo sería un no-op silencioso.
 * - Mientras el padre no tenga mensajes no aporta lotes y manda el respaldo
 *   estructural por solape de sesión (FR-012).
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
    // El memo se rige por `identity`, la identidad de los mensajes de los padres
    // (T039): el cuerpo relee la caché vigente **solo** cuando alguna marca
    // cambia, de modo que el tick de 1 s no re-deriva invocaciones.
    // Mismo patrón que el plan por `deriveExecutionKey` en `useGraphModel` (R4/R8).
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
