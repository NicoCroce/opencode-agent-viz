import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Etiqueta legible de los 9 estados de ejecución (FR-017). Única fuente de
 * verdad compartida por el nodo, el punto de estado, el inspector y el
 * histórico para que todas las vistas sean consistentes (FR-023). Ver
 * `contracts/execution-state-contract.md`.
 */
export const NODE_STATUS_LABEL: Record<TNodeStatus, string> = {
  created: 'Creada',
  running: 'En curso',
  retrying: 'Reintentando',
  compacting: 'Compactando',
  'waiting-permission': 'Esperando permiso',
  'waiting-input': 'Esperando respuesta',
  succeeded: 'Terminada',
  failed: 'Fallida',
  interrupted: 'Interrumpida',
};
