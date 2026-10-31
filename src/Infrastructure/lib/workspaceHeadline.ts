import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import type { TGraphNode } from '@app/Domains/Graph';
import type { TSessionSummary } from '@app/Domains/Inspector';
import type { TSessionGroup } from '@app/Domains/Sessions';

/**
 * Tono del eyebrow de la cabecera del grafo: decide el color del estado global
 * de la sesión (cyan activo, ámbar esperando, error, neutro en reposo).
 */
export const HEADLINE_TONE = {
  RUNNING: 'running',
  WAITING: 'waiting',
  ERROR: 'error',
  IDLE: 'idle',
} as const;

export type THeadlineTone = (typeof HEADLINE_TONE)[keyof typeof HEADLINE_TONE];

/** Etiqueta agrupada de las dos esperas (misma que el contador de la barra). */
const WAITING_LABEL = 'Esperando';
/** Etiqueta del estado global cuando algún agente falló. */
const ERROR_LABEL = 'Con error';

export interface TGraphPaneHeadline {
  /** Estado global legible (p. ej. "En curso"); `null` sin resumen. */
  statusLabel: string | null;
  tone: THeadlineTone;
  /** Nº de agentes cargados en el grafo. */
  agentCount: number;
  /** Título de la sesión abierta (tarea del nodo raíz o su agente). */
  title: string | null;
}

type THeadlineCounts = Pick<
  TSessionSummary,
  | 'runningCount'
  | 'retryingCount'
  | 'compactingCount'
  | 'waitingCount'
  | 'errorCount'
  | 'interruptedCount'
  | 'succeededCount'
  | 'createdCount'
>;

/**
 * Estado global de la sesión a partir de los contadores del resumen. Prioridad:
 * una espera (pide acción) gana a la actividad; luego en curso (incluye
 * reintento/compactación), error, interrupción, terminada y creada.
 */
const deriveStatus = (
  summary: THeadlineCounts | null,
): Pick<TGraphPaneHeadline, 'statusLabel' | 'tone'> => {
  if (!summary) return { statusLabel: null, tone: HEADLINE_TONE.IDLE };
  if (summary.waitingCount > 0) {
    return { statusLabel: WAITING_LABEL, tone: HEADLINE_TONE.WAITING };
  }
  const active =
    summary.runningCount + summary.retryingCount + summary.compactingCount;
  if (active > 0) {
    return { statusLabel: NODE_STATUS_LABEL.running, tone: HEADLINE_TONE.RUNNING };
  }
  if (summary.errorCount > 0) {
    return { statusLabel: ERROR_LABEL, tone: HEADLINE_TONE.ERROR };
  }
  if (summary.interruptedCount > 0) {
    return { statusLabel: NODE_STATUS_LABEL.interrupted, tone: HEADLINE_TONE.ERROR };
  }
  if (summary.succeededCount > 0) {
    return { statusLabel: NODE_STATUS_LABEL.succeeded, tone: HEADLINE_TONE.IDLE };
  }
  if (summary.createdCount > 0) {
    return { statusLabel: NODE_STATUS_LABEL.created, tone: HEADLINE_TONE.IDLE };
  }
  return { statusLabel: null, tone: HEADLINE_TONE.IDLE };
};

/**
 * Cabecera del panel del grafo (eyebrow + título): estado global, nº de agentes
 * y título de la sesión abierta. Función pura sobre el resumen ya agregado y los
 * nodos cargados; no abre consultas.
 */
export const deriveGraphPaneHeadline = (
  nodes: readonly TGraphNode[],
  rootId: string | null,
  summary: THeadlineCounts | null,
): TGraphPaneHeadline => {
  const root =
    nodes.find((node) => node.data.sessionId === rootId)?.data ?? null;

  return {
    ...deriveStatus(summary),
    agentCount: nodes.length,
    title: root?.title ?? root?.agentName ?? null,
  };
};

/** Nº total de sesiones raíz del rail, sumando todos los grupos por proyecto. */
export const countRailSessions = (groups: readonly TSessionGroup[]): number =>
  groups.reduce((total, group) => total + group.items.length, 0);
