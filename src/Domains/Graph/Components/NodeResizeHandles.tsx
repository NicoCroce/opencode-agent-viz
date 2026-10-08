import { NodeResizer } from '@xyflow/react';
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH } from '../lib/nodeResize';

/**
 * Tiradores planos (sin sombra) ocultos por defecto y revelados en
 * hover/focus/selected (FR-004). `pointer-events-none` evita arrastrar
 * controles invisibles cuando el nodo no está activo.
 */
const resizeControlClassName = (selected: boolean): string =>
  selected
    ? 'opacity-100'
    : 'pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100';

interface NodeResizeHandlesProps {
  nodeId: string;
  selected: boolean;
}

/**
 * Envuelve `<NodeResizer>` con los mínimos de tamaño del grafo y las clases
 * planas de visibilidad. Extraído de `AgentNode` (DC-14) para reutilizarlo en
 * cualquier nodo redimensionable.
 */
export const NodeResizeHandles = ({
  nodeId,
  selected,
}: NodeResizeHandlesProps) => (
  <NodeResizer
    nodeId={nodeId}
    isVisible
    minWidth={MIN_NODE_WIDTH}
    minHeight={MIN_NODE_HEIGHT}
    lineClassName={resizeControlClassName(selected)}
    handleClassName={resizeControlClassName(selected)}
    handleStyle={{ border: 'none', borderRadius: 0 }}
  />
);
