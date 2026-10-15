import { useMemo } from 'react';
import type {
  TCompactionEffect,
  TGraphNode,
  TNodeContextMetrics,
  TParentImpact,
} from '@app/Domains/Graph/Graph.entity';
import { deriveCompactionEffect } from '@app/Domains/Graph/lib/metrics/contextGrowth';
import { deriveParentImpact } from '@app/Domains/Graph/lib/metrics/parentImpact';
import type { TContextUsage } from '../Inspector.entity';
import { useGetModelCatalog, useSessionMessages } from '../Inspector.service';
import { deriveContextUsage, findContextLimit } from '../lib/contextUsage';

export interface ContextMetricsData {
  /** Métricas de contexto del nodo (ya derivadas en el grafo). */
  context: TNodeContextMetrics | null;
  /** Aporte del nodo al contexto de su padre; `null` si no aplica (US3). */
  parentImpact: TParentImpact | null;
  /** Efecto de la última compactación sobre la ventana; `null` sin ninguna. */
  compactionEffect: TCompactionEffect | null;
  /**
   * Uso de la ventana frente al límite del modelo; `null` mientras el catálogo
   * carga, si falla o si el modelo no figura en él (la fila muestra solo tokens).
   */
  usage: TContextUsage | null;
  /** Sesión del padre, para navegar a ella; `null` si no hay padre. */
  parentId: string | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Orquestador de las métricas de contexto de un nodo para el panel de detalle
 * (`contracts/context-panel-contract.md` §1). El contexto vive ya en el modelo
 * del grafo (research R3); el aporte al padre se calcula **bajo demanda** con
 * los mensajes del padre (`useSessionMessages`, ya cacheados por el
 * enriquecimiento) y el vínculo tool de spawn (research R5). Toda la lógica vive
 * aquí; los componentes son presentación pura (AGENTS §4).
 */
export const useContextMetrics = (
  node: TGraphNode | null,
  invokedBy: TGraphNode | null = null,
): ContextMetricsData => {
  const parentId = invokedBy?.data.sessionId ?? null;
  const parentMessages = useSessionMessages(parentId);

  const parentImpact = useMemo(
    () =>
      parentId !== null && node !== null
        ? deriveParentImpact(
            parentId,
            parentMessages.messages,
            node.data.sessionId,
          )
        : null,
    [parentId, parentMessages.messages, node],
  );

  // Efecto de la última compactación sobre la ventana (FR-016): se calcula con
  // la evolución y las compactaciones ya derivadas en el modelo del grafo.
  const context = node?.data.context ?? null;
  const compactionEffect = useMemo(() => {
    const list = context?.compactions ?? [];
    const last = list[list.length - 1];
    return last ? deriveCompactionEffect(context?.growth ?? [], last) : null;
  }, [context]);

  // El catálogo no bloquea la sección: sin él, `usage` queda en `null`.
  const catalog = useGetModelCatalog(node?.data.directory ?? null);
  const model = node?.data.model ?? null;
  const windowTokens = context?.window.windowTokens ?? null;
  const usage = useMemo(
    () =>
      deriveContextUsage(
        windowTokens,
        findContextLimit(catalog.data ?? [], model),
      ),
    [windowTokens, catalog.data, model],
  );

  return {
    context,
    parentImpact,
    compactionEffect,
    usage,
    parentId,
    isLoading: parentMessages.isLoading,
    isError: parentMessages.isError,
  };
};
