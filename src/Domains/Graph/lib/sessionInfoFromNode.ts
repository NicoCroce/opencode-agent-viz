import type { SessionInfo } from '@opencode/client';
import type { TGraphNode } from '../Graph.entity';

/**
 * Reconstruye la `SessionInfo` mínima que necesita `orderSubtreeForLoad`
 * (topología + `time.created`/`time.updated`) a partir de un nodo estructural.
 * La estructura no conserva la `SessionInfo` original, así que se rellenan los
 * campos no usados por el orden con valores neutros (Principio IV: no se
 * redefinen los tipos del SDK).
 */
export const sessionInfoFromNode = (
  node: TGraphNode,
  parentId: string | undefined,
): SessionInfo => ({
  id: node.id,
  ...(parentId === undefined ? {} : { parentID: parentId }),
  projectID: '',
  agent: node.data.agentName,
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: {
    created: node.data.createdAt ?? 0,
    updated: node.data.updatedAt ?? 0,
  },
  ...(node.data.title === null ? {} : { title: node.data.title }),
  location: { directory: node.data.directory },
});
