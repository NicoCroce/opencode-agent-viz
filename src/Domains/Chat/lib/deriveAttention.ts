import type { PermissionRequest } from '@opencode/client';
import type {
  TGraphModel,
  TGraphNode,
  TNodeStatus,
} from '@app/Domains/Graph/Graph.entity';
import type { TAttentionItem } from '../Chat.entity';

/**
 * Derivación de atención (data-model §2.3, `contracts/attention-contract.md` §1,
 * research R6). Función **pura** y única fuente de las cinco señales
 * (badge/banner/toast/realce, FR-009): recorre los nodos del (sub)grafo en
 * `waiting-permission`/`waiting-input` y los cruza con la lista global
 * `permissions.list()` (que incluye los permisos de **sesiones hijas**, porque
 * el evento trae su `sessionID`) para construir `TAttentionItem[]`.
 *
 * Reglas:
 * - `permission`: un ítem por permiso abierto de la sesión del nodo; `id`,
 *   `title` (`action`) y `sessionId` de origen salen del propio permiso.
 * - `question`: un ítem por nodo en `waiting-input`; sin acceso a los formularios
 *   en esta firma, el `id` es estable por sesión y el `title` cae al título del
 *   nodo.
 * - `nodeId` = nodo afectado del (sub)grafo (para el realce).
 * - `at` = instante del pendiente, tomado de `data.updatedAt` del nodo.
 * - Salida ordenada por `at` ascendente; sin pendientes → `[]`. Al resolverse un
 *   pendiente deja de producirse su ítem y todas las señales desaparecen
 *   (FR-011). No muta las entradas.
 */

const PENDING_STATUSES: ReadonlySet<TNodeStatus> = new Set([
  'waiting-permission',
  'waiting-input',
]);

/** `data.updatedAt` como instante del pendiente; `0` si aún no se conoce. */
const atOf = (node: TGraphNode): number => node.data.updatedAt ?? 0;

/** Ítem de pregunta derivado del nodo (sin formularios en esta firma). */
const questionItem = (node: TGraphNode): TAttentionItem => ({
  id: `question:${node.data.sessionId}`,
  kind: 'question',
  sessionId: node.data.sessionId,
  nodeId: node.id,
  title: node.data.title ?? 'Pregunta pendiente',
  at: atOf(node),
});

/** Ítem de permiso derivado del permiso abierto y su nodo de origen. */
const permissionItem = (
  node: TGraphNode,
  permission: PermissionRequest,
): TAttentionItem => ({
  id: permission.id,
  kind: 'permission',
  sessionId: permission.sessionID,
  nodeId: node.id,
  title: permission.action,
  at: atOf(node),
});

export function deriveAttention(
  graph: TGraphModel,
  permissions: PermissionRequest[],
): TAttentionItem[] {
  const items: TAttentionItem[] = [];

  for (const node of graph.nodes) {
    const status = node.data.status;
    if (!PENDING_STATUSES.has(status)) continue;

    if (status === 'waiting-input') {
      items.push(questionItem(node));
      continue;
    }

    // `waiting-permission`: cruza con los permisos abiertos de la sesión de
    // origen (puede ser una hija); un permiso de otra sesión no aplica aquí.
    for (const permission of permissions) {
      if (permission.sessionID !== node.data.sessionId) continue;
      items.push(permissionItem(node, permission));
    }
  }

  // `Array.prototype.sort` es estable: con `at` iguales se conserva el orden de
  // recorrido del grafo.
  return items.sort((a, b) => a.at - b.at);
}
