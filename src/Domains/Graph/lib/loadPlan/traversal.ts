import type { SessionInfo } from '@opencode/client';
import { deriveExecutionLevels } from '../executionLevels';
import { toStructuralModel } from './toStructuralModel';

/** Cadena de ancestros de `id` desde la raíz del subárbol hasta `id` (inclusive). */
export const ancestorChain = (
  id: string,
  byId: ReadonlyMap<string, SessionInfo>,
): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = byId.get(current)?.parentID;
  }
  return chain.reverse();
};

/**
 * Comparador determinista de ids por `time.created` ascendente y `id`
 * lexicográfico, leyendo los tiempos de `byId` (sin reloj implícito).
 */
export const compareByTimeThenId = (
  byId: ReadonlyMap<string, SessionInfo>,
): ((a: string, b: string) => number) => {
  const createdOf = (id: string): number => byId.get(id)?.time.created ?? 0;
  return (a, b) => createdOf(a) - createdOf(b) || a.localeCompare(b);
};

/**
 * Orden del "resto" por **nivel de ejecución** (misma agrupación por tanda que
 * `deriveExecutionLevels`); dentro de cada nivel, por `time.created` ascendente y
 * `id` lexicográfico. Determinista y sin reloj implícito (contrato de carga
 * §2.1, data-model §2.3).
 */
export const executionLevelOrder = (
  subtree: readonly SessionInfo[],
  byId: ReadonlyMap<string, SessionInfo>,
): string[] => {
  const plan = deriveExecutionLevels(toStructuralModel(subtree), 0);
  const compare = compareByTimeThenId(byId);

  const order: string[] = [];
  for (const level of plan.levels) {
    order.push(...[...level.nodeIds].sort(compare));
  }
  return order;
};
