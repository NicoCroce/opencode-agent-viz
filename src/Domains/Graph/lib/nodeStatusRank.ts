import type { TNodeStatus } from '../Graph.entity';

/**
 * Rango de agregación por nivel de ejecución (FR-023): cuando un carril reúne
 * varios agentes, se muestra el estado dominante. Los estados activos (esperas,
 * en curso, reintentando, compactando) pesan más que los terminales, de modo que
 * un nivel con algún agente activo se lee como "en curso"; dentro de los
 * terminales, fallo/interrupción pesan más que terminada. Ver
 * `contracts/execution-state-contract.md`.
 */
export const nodeStatusRank: Record<TNodeStatus, number> = {
  created: 0,
  succeeded: 1,
  interrupted: 2,
  failed: 3,
  'waiting-permission': 4,
  'waiting-input': 5,
  running: 6,
  retrying: 7,
  compacting: 8,
};

/**
 * Devuelve el estado "peor" (mayor `nodeStatusRank`) entre el actual y el
 * candidato; se usa para agregar el estado dominante de un nivel de ejecución.
 */
export const worseNodeStatus = (
  current: TNodeStatus | undefined,
  candidate: TNodeStatus,
): TNodeStatus =>
  current === undefined || nodeStatusRank[candidate] > nodeStatusRank[current]
    ? candidate
    : current;
