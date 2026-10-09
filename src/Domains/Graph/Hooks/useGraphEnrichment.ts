import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { scheduleIdle } from '@app/Application/Helpers/scheduleIdle';
import { queryKeys } from '../../queryKeys';
import { useGetSessionStatus } from '../../Sessions/Sessions.service';
import type { TGraphModel } from '../Graph.entity';
import { buildEnrichmentPlan } from '../lib/buildEnrichmentPlan';
import { enrichNodeData, readNodeEnrichmentInput } from '../lib/enrichNodeData';
import { loadNodeContent } from '../lib/loadNodeContent';
import { chunkLoadPlan } from '../lib/loadPriority';

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
            }),
          }
        : node,
    );
    return { nodes, edges: structure.edges };
  }, [structure, readyIds, statusQuery.data, queryClient, now]);
};
