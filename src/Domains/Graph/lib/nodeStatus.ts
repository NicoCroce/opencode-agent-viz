import type { SessionStatus } from '@opencode/client';
import type { TNodeStatus } from '../Graph.entity';

interface NodeStatusInput {
  status?: SessionStatus;
  hasActivity: boolean;
  hasPermission: boolean;
  hasError: boolean;
}

export const toNodeStatus = ({
  status,
  hasActivity,
  hasPermission,
  hasError,
}: NodeStatusInput): TNodeStatus => {
  if (hasPermission) return 'waiting';
  if (hasError) return 'error';
  if (status?.type === 'busy' || status?.type === 'retry') return 'running';
  return hasActivity ? 'done' : 'idle';
};
