import type { Node } from '@xyflow/react';
import type { TGraphNode, TGraphNodeData, TNodeSizeOverride } from '../Graph.entity';
import { cardHeight } from './cardHeight';
import { NODE_WIDTH } from './layoutGraph';

/** Nodo ya listo para `<ReactFlow>`: modelo + selección + overrides de usuario. */
export type TGraphViewNode = Node<TGraphNodeData, 'agent'>;

/**
 * Construye los nodos que consume `<ReactFlow>` combinando el modelo derivado
 * (`graph.nodes`) con los overrides de tamaño/posición elegidos por el usuario.
 *
 * Función pura, sin React (Principio V): no muta la entrada y no relayouta.
 *
 * - `selected` refleja la selección explícita (`selectedNodeId`).
 * - `width`/`height` del override se conservan siempre (FR-003); sin override el
 *   alto lo calcula `cardHeight` según el contenido, así el nodo nunca se
 *   recorta.
 * - Los `x`/`y` del override solo se aplican fuera del modo cadena. En modo
 *   cadena (`isChainMode === true`) se ignoran para respetar las posiciones de
 *   `layoutChain` y mantener la fila única raíz→nodo (FR-006): un resize previo
 *   desde un tirador superior/izquierdo no debe pisar la fila.
 */
export const buildViewNodes = (
  nodes: TGraphNode[],
  overrides: Record<string, TNodeSizeOverride>,
  selectedNodeId: string | null,
  isChainMode: boolean,
): TGraphViewNode[] =>
  nodes.map((node) => {
    const override = overrides[node.id];
    const width = override?.width ?? NODE_WIDTH;
    return {
      ...node,
      selected: node.id === selectedNodeId,
      width,
      height: override?.height ?? cardHeight(node.data, width),
      ...(override && !isChainMode
        ? {
            // En modo cadena las posiciones las fija `layoutChain`; ignorar el
            // override de posición evita romper la fila única.
            position: {
              x: override.x ?? node.position.x,
              y: override.y ?? node.position.y,
            },
          }
        : {}),
    };
  });
