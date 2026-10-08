import type { TExecutionSignal } from '../../Graph.entity';
import { EMPTY_EXECUTION_SIGNAL } from '../executionSignal';
import { signalsOf } from './cache';

/**
 * Parchea la senal de ejecucion de una sesion. La senal vacia es la fuente
 * unica `EMPTY_EXECUTION_SIGNAL` (SH-08), no un literal local.
 */
export const patchExecution = (
  prev: unknown,
  sessionID: string,
  patch: Partial<TExecutionSignal>,
): Record<string, TExecutionSignal> => {
  const signals = signalsOf(prev);
  const current = signals[sessionID] ?? EMPTY_EXECUTION_SIGNAL;
  return { ...signals, [sessionID]: { ...current, ...patch } };
};
