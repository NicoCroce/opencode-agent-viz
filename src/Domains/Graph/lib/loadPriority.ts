/**
 * Fachada pública del plan de carga (contrato de carga §2, feature 006).
 *
 * El cómputo vive en `lib/loadPlan/` (modelo estructural, recorrido de árbol,
 * priorización y troceado); este módulo conserva la ruta pública original para no
 * romper los import specifiers de hooks, componentes y specs.
 */
export { LOAD_CHUNK_SIZE, chunkLoadPlan } from './loadPlan/chunk';
export {
  orderSubtreeForLoad,
  type TLoadOptions,
  type TLoadPlan,
} from './loadPlan/orderSubtreeForLoad';
