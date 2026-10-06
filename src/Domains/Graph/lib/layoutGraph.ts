import type { TGraphModel } from '../Graph.entity';

/** Ancho base de un nodo de agente (compartido con el resize y la vista). */
export const NODE_WIDTH = 220;
/**
 * Alto fijo de la card de agente. Fijarlo evita el recorte por medición tardía
 * y permite dimensionar el carril de ejecución en proporción al nodo.
 */
export const NODE_CARD_HEIGHT = 136;
/** Alto de referencia para centrar el viewport (el nodo real crece con contenido). */
export const NODE_HEIGHT = 76;

/**
 * Firma de topología: ids de nodos y aristas ordenados. Cambia solo cuando
 * cambia la estructura del grafo, no cuando cambian datos (estado, métricas).
 * Es la clave con la que se memoiza el layout (Principio VII).
 */
export const topologySignature = (model: TGraphModel): string => {
  const nodeIds = model.nodes
    .map((n) => n.id)
    .sort()
    .join(',');
  const edgeIds = model.edges
    .map((e) => e.id)
    .sort()
    .join(',');
  return `${nodeIds}|${edgeIds}`;
};
