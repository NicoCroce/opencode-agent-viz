import type { NodeChange } from '@xyflow/react';
import type { TGraphNode, TNodeSizeOverride } from '../Graph.entity';

/**
 * Tamaño mínimo al que se puede reducir un nodo (debe coincidir con AgentNode).
 * El ancho mínimo es 340 px, igual que el ancho base (`NODE_WIDTH`): el nodo
 * nunca se reduce por debajo de su tamaño por defecto.
 */
export const MIN_NODE_WIDTH = 340;
export const MIN_NODE_HEIGHT = 72;

/**
 * `true` solo para los cambios de dimensiones originados por el resize del
 * usuario (arrastre de un tirador de `NodeResizer`).
 *
 * React Flow emite dos clases de `NodeDimensionChange`:
 * - Resize del usuario: `resizing` presente (`true` durante el arrastre, `false`
 *   al soltar) y, durante el arrastre, también `setAttributes`.
 * - Medición automática del `ResizeObserver` interno (primer render y cambios de
 *   contenido): sin `resizing` ni `setAttributes`.
 *
 * Se exige al menos uno de esos campos para no confundir la medición con una
 * acción del usuario (FR-002).
 */
const isUserResize = (
  change: Extract<NodeChange<TGraphNode>, { type: 'dimensions' }>,
): boolean => change.resizing !== undefined || change.setAttributes !== undefined;

/**
 * Reduce los cambios emitidos por React Flow a un mapa de tamaños/posiciones
 * elegidos por el usuario para cada nodo.
 *
 * Función pura, sin React (Principio V): no muta `overrides` ni los cambios y
 * devuelve siempre un mapa nuevo.
 *
 * - `NodeDimensionChange` **del resize del usuario** con `dimensions` definidas
 *   → fija `width`/`height` aplicando `MIN_NODE_WIDTH`/`MIN_NODE_HEIGHT`.
 * - `NodeDimensionChange` de **medición automática** (sin `resizing` ni
 *   `setAttributes`) → se ignora, para que el alto siga siendo automático por
 *   contenido hasta que el usuario redimensione y no se recorte la línea de
 *   herramienta actual (FR-002).
 * - `NodePositionChange` emitido por el resize (agrandar desde arriba/izquierda)
 *   → fija `x`/`y`; solo si el nodo ya tiene un override (el resize siempre
 *   emite también un cambio de dimensiones en el mismo lote).
 * - Ignora selección y cualquier otro tipo de cambio.
 *
 * El orden dentro del lote no importa: los cambios de posición del resize se
 * emiten antes que los de dimensiones, por eso se resuelven en dos pasadas.
 */
export const reduceNodeOverrides = (
  overrides: Record<string, TNodeSizeOverride>,
  changes: NodeChange<TGraphNode>[],
): Record<string, TNodeSizeOverride> => {
  // Se clona de forma perezosa: si ningún cambio es relevante devolvemos la
  // MISMA referencia. Así el llamador puede evitar un re-render, lo que importa
  // porque React Flow emite una `NodeDimensionChange` de medición automática en
  // cada montaje: un re-render con nodos nuevos haría que React Flow descarte
  // las dimensiones medidas y oculte los nodos (`visibility: hidden`).
  let next = overrides;

  for (const change of changes) {
    if (
      change.type === 'dimensions' &&
      change.dimensions &&
      isUserResize(change)
    ) {
      if (next === overrides) next = { ...overrides };
      const prev = next[change.id];
      next[change.id] = {
        ...prev,
        width: Math.max(MIN_NODE_WIDTH, change.dimensions.width),
        height: Math.max(MIN_NODE_HEIGHT, change.dimensions.height),
      };
    }
  }

  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      const prev = next[change.id];
      if (!prev) continue;
      if (next === overrides) next = { ...overrides };
      next[change.id] = {
        ...prev,
        x: change.position.x,
        y: change.position.y,
      };
    }
  }

  return next;
};
