import type { SessionStatus } from '@opencode/client';
import type { TNodeStatus } from '../Graph.entity';

interface NodeStatusInput {
  status?: SessionStatus;
  hasActivity: boolean;
  hasPermission: boolean;
  hasPendingForm: boolean;
  compaction: 'running' | 'completed' | 'failed' | null;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  lastAssistantErrored: boolean;
}

/**
 * Deriva el estado de ejecución de un agente (FR-017..FR-023) aplicando la
 * prioridad exacta del contrato `contracts/execution-state-contract.md`.
 *
 * FR-020: los estados activos (retry/compaction/esperas) y el resultado
 * terminal ganan sobre `busy`; `lastAssistantErrored` solo aplica cuando no
 * hay outcome ni estado activo, de modo que un error superado nunca tiñe de
 * `failed` una ejecución activa ni una `succeeded`.
 */
export const toNodeStatus = ({
  status,
  hasActivity,
  hasPermission,
  hasPendingForm,
  compaction,
  outcome,
  lastAssistantErrored,
}: NodeStatusInput): TNodeStatus => {
  if (status?.type === 'retry') return 'retrying';
  if (compaction === 'running') return 'compacting';
  if (hasPendingForm) return 'waiting-input';
  if (hasPermission) return 'waiting-permission';
  if (outcome === 'interrupted') return 'interrupted';
  if (outcome === 'failed') return 'failed';
  if (outcome === 'succeeded') return 'succeeded';
  if (status?.type === 'busy') return 'running';
  if (hasActivity) return lastAssistantErrored ? 'failed' : 'succeeded';
  return 'created';
};

const ACTIVE_STATUSES: ReadonlySet<TNodeStatus> = new Set([
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
]);

/**
 * Predicado puro que reemplaza las comparaciones dispersas
 * (`status === 'running' || status === 'waiting'`) en `AgentNode`,
 * `AgentGraph` y `useGraphModel`.
 */
export const isActiveStatus = (status: TNodeStatus): boolean =>
  ACTIVE_STATUSES.has(status);
