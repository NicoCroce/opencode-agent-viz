import type { SessionInfo } from '@opencode/client';
import type { TGraphEdge } from '../../Graph.entity';

/**
 * Construye las aristas de invocación padre→hijo a partir de las sesiones.
 *
 * Solo se crea una arista cuando el `parentID` de una sesión apunta a otra
 * sesión presente en `nodeIds`: el grafo puede ser un subárbol, y un padre fuera
 * del conjunto no debe generar una arista huérfana.
 */
export const buildEdges = (
  sessions: readonly SessionInfo[],
  nodeIds: ReadonlySet<string>,
): TGraphEdge[] =>
  sessions
    .filter((s) => s.parentID !== undefined && nodeIds.has(s.parentID))
    .map((s) => ({
      id: `${s.parentID}->${s.id}`,
      source: s.parentID as string,
      target: s.id,
      type: 'agent' as const,
    }));
