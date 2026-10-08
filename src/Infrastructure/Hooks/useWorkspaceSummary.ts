import { useMemo } from 'react';
import {
  isActiveStatus,
  summarizeSession,
  useNow,
  type TGraphModel,
} from '@app/Domains/Graph';
import type { TResourceUsage, TSessionSummary } from '@app/Domains/Inspector';
import type { TRootSessionItem } from '@app/Domains/Sessions';
import { EMPTY_RESOURCE_USAGE } from '../WorkspacePage.constants';

interface UseWorkspaceSummaryParams {
  items: TRootSessionItem[];
  id: string | null;
  graph: TGraphModel;
  resourceUsage?: TResourceUsage;
}

interface UseWorkspaceSummaryResult {
  summary: TSessionSummary | null;
  now: number;
}

/**
 * Resumen agregado de la sesión (FR-024..FR-027) sobre los nodos ya cargados en
 * el grafo. `now` avanza en vivo para que el tiempo transcurrido se actualice en
 * el sitio sin relayoutar el grafo (FR-027).
 *
 * El tick solo se activa si hay al menos un nodo en curso (`isActiveStatus`),
 * igual que el reloj del modelo (FR-006, SC-005, R3): sin actividad, `now` no
 * altera ningún dato del resumen, así que no hay `setInterval` ni re-renders
 * innecesarios (Principio VII). `useNow` se importa por el **barrel** de dominio
 * para que el espía de `WorkspacePage.perf.spec.tsx` siga interceptándolo.
 */
export const useWorkspaceSummary = ({
  items,
  id,
  graph,
  resourceUsage = EMPTY_RESOURCE_USAGE,
}: UseWorkspaceSummaryParams): UseWorkspaceSummaryResult => {
  const hasActiveNode = useMemo(
    () => graph.nodes.some((node) => isActiveStatus(node.data.status)),
    [graph.nodes],
  );
  const now = useNow({ enabled: Boolean(id) && hasActiveNode });
  const summary = useMemo(() => {
    const rootSession =
      items.find((item) => item.session.id === id)?.session ?? null;
    return rootSession
      ? summarizeSession(rootSession, graph, resourceUsage, now)
      : null;
  }, [items, id, graph, resourceUsage, now]);

  return { summary, now };
};
