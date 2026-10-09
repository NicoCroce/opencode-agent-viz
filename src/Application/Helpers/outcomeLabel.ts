import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/** Resultado terminal de un turno (unión compartida por History y Graph). */
export type TOutcome = 'succeeded' | 'failed' | 'interrupted';

/**
 * Etiqueta del resultado final del turno. Solo los estados terminales lo
 * tienen; una ejecución activa o recién creada no reporta resultado (FR-038).
 *
 * El wording es deliberadamente distinto al de `NODE_STATUS_LABEL`, que usa
 * "Terminada" como etiqueta corta de nodo: aquí es "Terminada con éxito", el
 * resultado del turno. No se fusionan.
 */
export const OUTCOME_LABEL: Record<TOutcome, string> = {
  succeeded: 'Terminada con éxito',
  failed: 'Fallida',
  interrupted: 'Interrumpida',
};

/**
 * Estrecha un estado de nodo arbitrario a la unión terminal de resultado,
 * para poder indexar `OUTCOME_LABEL` sin `Partial<Record<TNodeStatus, string>>`
 * (que devolvía `undefined` sin error de compilación ante un estado no terminal).
 */
export const isTerminalOutcome = (status: TNodeStatus): status is TOutcome =>
  status === 'succeeded' || status === 'failed' || status === 'interrupted';
