/**
 * Estado real de una llamada a herramienta: unión de los estados del histórico
 * (`ToolCallEntry`: streaming/running/completed/error) y del inspector
 * (`ToolHistory`: running/completed/error/pending). Cubre la unión completa para
 * eliminar el fallback silencioso con el que `ToolHistory` dejaba `streaming`
 * sin color.
 */
export type TToolStatus =
  | 'streaming'
  | 'running'
  | 'completed'
  | 'error'
  | 'pending';

/** Etiqueta del estado real de la llamada; nunca inventa un resultado (FR-004). */
export const TOOL_STATUS_LABEL: Record<TToolStatus, string> = {
  streaming: 'En curso',
  running: 'Ejecutando',
  completed: 'Completada',
  error: 'Fallida',
  pending: 'Pendiente',
};

/** Color semántico del estado (reutiliza los tokens de la feature 001). */
export const TOOL_STATUS_COLOR: Record<TToolStatus, string> = {
  streaming: 'text-status-running',
  running: 'text-status-running',
  completed: 'text-status-done',
  error: 'text-status-error',
  pending: 'text-status-idle',
};
