/**
 * Fachada pública de la reconciliación de modelos de grafo (R4, contrato de
 * render §1.1). Conserva la ruta de import original mientras la implementación
 * vive en `./reconcile/`.
 *
 * `reconcileGraphModel(prev, next)` reutiliza la identidad de nodos/aristas
 * comparando `data` campo a campo, de modo que `AgentNode`/`InvocationEdge`
 * (`React.memo`) solo re-renderizan cuando sus props cambian de verdad.
 */
export { reconcileGraphModel } from './reconcile/reconcileGraphModel';
export {
  sameStringArray,
  sameTokenUsage,
  sameMetrics,
  sameModel,
  sameRetry,
  sameCurrentTool,
  sameParallel,
  sameNodeData,
  sameNode,
} from './reconcile/comparators';
