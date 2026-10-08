import type { SessionInfo } from '@opencode/client';

/**
 * BFS del subárbol desde `rootId` siguiendo `parentID`, con índice `Map` para
 * resolver en O(n) (R4).
 *
 * Es la construcción estructural que necesita el modelo por fases; vive en
 * `lib/` como función pura testeable y se reexporta desde `useGraphStructure`
 * para conservar la API pública que ya exponía el barrel de `Hooks`.
 */
export const filterSubtree = (
  sessions: SessionInfo[],
  rootId: string | null,
): SessionInfo[] => {
  if (!rootId) return [];
  const byId = new Map<string, SessionInfo>();
  const byParent = new Map<string, SessionInfo[]>();
  for (const session of sessions) {
    if (!byId.has(session.id)) byId.set(session.id, session);
    if (session.parentID === undefined) continue;
    const list = byParent.get(session.parentID) ?? [];
    list.push(session);
    byParent.set(session.parentID, list);
  }

  const result: SessionInfo[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const session = byId.get(id);
    if (!session) continue;
    result.push(session);
    for (const child of byParent.get(id) ?? []) queue.push(child.id);
  }
  return result;
};
