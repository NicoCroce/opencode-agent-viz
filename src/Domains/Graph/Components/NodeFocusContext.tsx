import { createContext, useContext, type FC, type ReactNode } from 'react';

/**
 * Foco del grafo (selección/linaje + hover) publicado por contexto.
 *
 * Vive fuera de `data`/`style` de los nodos a propósito: así hover y selección
 * **no** reconstruyen los arrays que consume React Flow (contrato de render
 * §1.2). `AgentNode`/`InvocationEdge` lo leen con `useNodeFocus`.
 */
export interface TNodeFocus {
  /** Selección explícita; `null` = sin foco. */
  selectedNodeId: string | null;
  /** Conjunto de ids en el linaje (ancestros + descendientes) del seleccionado. */
  lineageNodeIds: ReadonlySet<string>;
  /** Conjunto de ids de aristas del linaje. */
  lineageEdgeIds: ReadonlySet<string>;
  /** Nodo bajo el cursor; `null` = sin hover. */
  hoveredNodeId: string | null;
  /**
   * Ids de nodos con un pendiente de atención (FR-009). Opcional: los focos que
   * solo derivan hover/selección lo omiten, y el nodo se lee sin realce. El
   * realce fluye por **contexto** —nunca por `data`— para no alterar la
   * identidad de render ni provocar relayout del grafo (Principio VII / FR-016).
   */
  attentionNodeIds?: ReadonlySet<string>;
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/**
 * Foco sin selección ni hover. Es el valor por defecto del contexto, de modo
 * que `useNodeFocus()` fuera de un provider devuelve un foco vacío y los specs
 * de `AgentNode`/`InvocationEdge` que no montan el provider siguen funcionando
 * (contrato de render §2).
 */
export const EMPTY_NODE_FOCUS: TNodeFocus = {
  selectedNodeId: null,
  lineageNodeIds: EMPTY_IDS,
  lineageEdgeIds: EMPTY_IDS,
  hoveredNodeId: null,
  attentionNodeIds: EMPTY_IDS,
};

const NodeFocusContext = createContext<TNodeFocus>(EMPTY_NODE_FOCUS);

interface NodeFocusProviderProps {
  value: TNodeFocus;
  children: ReactNode;
}

/**
 * Publica el foco actual al árbol del grafo. Envuelve el contenido de
 * `<ReactFlow>` para que los nodos/aristas memoizados lo consuman sin recibirlo
 * por props (contrato de render §1.2/§2).
 */
export const NodeFocusProvider: FC<NodeFocusProviderProps> = ({
  value,
  children,
}) => (
  <NodeFocusContext.Provider value={value}>
    {children}
  </NodeFocusContext.Provider>
);

/** Devuelve el foco actual; fuera de un provider, `EMPTY_NODE_FOCUS`. */
export const useNodeFocus = (): TNodeFocus => useContext(NodeFocusContext);

/**
 * `true` si el nodo tiene un pendiente de atención (FR-009). Selector puro sobre
 * el contexto: el realce llega al nodo sin tocar `data` y sin re-layoutar.
 */
export const useNodeAttention = (nodeId: string): boolean => {
  const { attentionNodeIds } = useNodeFocus();
  return attentionNodeIds?.has(nodeId) ?? false;
};
