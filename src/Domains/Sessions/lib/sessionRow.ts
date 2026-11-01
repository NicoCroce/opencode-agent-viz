import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import type { TSession, TSessionStatus } from '../Session.entity';

/**
 * Lógica pura de presentación de una sesión raíz en el listado (tarjeta del
 * rail y fila de la tabla) y del resumen de cabecera de la página.
 *
 * No depende del SDK ni del reloj: todo se deriva de `SessionInfo` y del mapa de
 * `SessionStatus` ya cacheado.
 */

/** Texto del agente cuando la sesión no lo expone (`SessionInfo.agent`). */
export const AGENT_UNAVAILABLE_LABEL = 'agente no disponible';

/** ¿La sesión está ejecutando? `busy` y `retry` cuentan como en curso (FR-015). */
export const isSessionRunning = (status?: TSessionStatus): boolean =>
  status?.type === 'busy' || status?.type === 'retry';

/** Estados que muestran el LED encendido (halo `glow-accent`). */
const LIVE_NODE_STATUSES: ReadonlySet<TNodeStatus> = new Set<TNodeStatus>([
  'running',
  'retrying',
  'compacting',
]);

/** ¿El estado es "vivo"? Solo esos llevan el halo del acento. */
export const isLiveNodeStatus = (status: TNodeStatus): boolean =>
  LIVE_NODE_STATUSES.has(status);

/**
 * Color de texto por estado, espejo de `NODE_STATUS_COLOR` (fondo del punto):
 * la etiqueta de estado de la tabla se pinta en el mismo tono que su punto.
 */
export const NODE_STATUS_TEXT_COLOR: Record<TNodeStatus, string> = {
  created: 'text-status-idle',
  running: 'text-status-running',
  retrying: 'text-status-running',
  compacting: 'text-status-running',
  'waiting-permission': 'text-status-waiting',
  'waiting-input': 'text-status-waiting',
  succeeded: 'text-status-done',
  failed: 'text-status-error',
  interrupted: 'text-status-error',
};

/**
 * Duración aproximada de la sesión: de la creación a la última actividad. Con
 * algún extremo ausente o no finito devuelve `null` (el formateador lo muestra
 * como no disponible).
 */
export const sessionDurationMs = (session: TSession): number | null => {
  const { created, updated } = session.time;
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return null;
  return updated - created;
};

/** Nº de sesiones en curso según el mapa de estados (cabecera de la página). */
export const countRunningSessions = (
  sessionIds: readonly string[],
  statuses: Record<string, TSessionStatus> | undefined,
): number =>
  sessionIds.filter((id) => isSessionRunning(statuses?.[id])).length;

/**
 * Antetítulo de la página: `N en curso · M sesiones`. Sin sesiones en curso se
 * omite el primer tramo. Las versalitas las aplica el CSS.
 */
export const buildSessionsEyebrow = ({
  running,
  total,
}: {
  running: number;
  total: number;
}): string => {
  const totalLabel = `${total} ${total === 1 ? 'sesión' : 'sesiones'}`;
  if (running === 0) return totalLabel;
  return `${running} en curso · ${totalLabel}`;
};
