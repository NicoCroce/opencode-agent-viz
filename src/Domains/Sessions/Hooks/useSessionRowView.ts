import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import {
  formatCost,
  formatDateTimeRange,
  formatDuration,
} from '@app/Application/Helpers';
import type { TSessionStatus } from '../Session.entity';
import {
  AGENT_UNAVAILABLE_LABEL,
  isLiveNodeStatus,
  isSessionRunning,
  sessionDurationMs,
} from '../lib/sessionRow';
import type { TRootSessionItem } from './useRootSessions';
import { useSessionNodeStatus } from './useSessionNodeStatus';

/** Vista ya formateada de una sesión raíz para la tarjeta y la fila de tabla. */
export interface TSessionRowView {
  id: string;
  title: string;
  /** Nombre del agente o `agente no disponible`. */
  agentLabel: string;
  nodeStatus: TNodeStatus;
  /** ¿El LED de estado va encendido (halo del acento)? */
  isLive: boolean;
  /** Rango `dd/mm HH:mm – dd/mm HH:mm` (o `en curso`). */
  timeRange: string;
  cost: string;
  duration: string;
}

/**
 * Deriva la vista de una sesión raíz del listado (FR-015..FR-017). El estado de
 * ejecución sale de `useSessionNodeStatus` (cross-domain en el hook, AGENTS
 * §8.3) salvo que el contenedor aporte uno ya derivado (`nodeStatus`).
 */
export const useSessionRowView = (
  item: TRootSessionItem,
  status?: TSessionStatus,
  nodeStatus?: TNodeStatus,
): TSessionRowView => {
  const { session, agentName } = item;
  const derivedNodeStatus = useSessionNodeStatus(status);
  const resolvedNodeStatus = nodeStatus ?? derivedNodeStatus;

  return {
    id: session.id,
    title: session.title ?? '',
    agentLabel: agentName ?? AGENT_UNAVAILABLE_LABEL,
    nodeStatus: resolvedNodeStatus,
    isLive: isLiveNodeStatus(resolvedNodeStatus),
    timeRange: formatDateTimeRange({
      startedAt: session.time.created,
      endedAt: session.time.updated,
      isRunning: isSessionRunning(status),
    }),
    cost: formatCost(session.cost),
    duration: formatDuration(sessionDurationMs(session)),
  };
};
