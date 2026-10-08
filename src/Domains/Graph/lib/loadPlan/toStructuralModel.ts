import type { SessionInfo } from '@opencode/client';
import {
  EMPTY_METRICS,
  type TGraphModel,
  type TGraphNode,
} from '../../Graph.entity';
import { buildEdges } from '../graphBuild/buildEdges';

/**
 * Construye un `TGraphModel` **estructural** mínimo a partir del subárbol para
 * reaprovechar el mismo agrupamiento por tanda que el layout
 * (`deriveExecutionLevels`). Los nodos solo aportan la topología y los tiempos
 * de `SessionInfo` (`time.created`/`time.idle ?? time.updated`); el resto de
 * campos de vista son neutros y no intervienen en el orden.
 */
export const toStructuralModel = (
  subtree: readonly SessionInfo[],
): TGraphModel => {
  const nodeIds = new Set(subtree.map((session) => session.id));

  const nodes: TGraphNode[] = subtree.map((session) => ({
    id: session.id,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: {
      sessionId: session.id,
      title: session.title ?? null,
      createdAt: session.time.created,
      updatedAt: session.time.idle ?? session.time.updated,
      agentName: session.agent ?? '',
      directory: session.location.directory,
      model: null,
      status: 'created',
      retry: null,
      interruptReason: null,
      metrics: EMPTY_METRICS,
      isRoot: session.parentID === undefined,
      currentTool: null,
      parallel: null,
    },
  }));

  return { nodes, edges: buildEdges(subtree, nodeIds) };
};
