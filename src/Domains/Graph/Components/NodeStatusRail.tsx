import { NODE_STATUS_COLOR } from '@app/Application/Helpers/nodeStatusColor';
import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '../Graph.entity';

/**
 * Rayado diagonal plano de loop (FR-018): se conserva como firma de reintento,
 * con el tono `running` del estado reintentando.
 */
const LOOP_STRIPE =
  'repeating-linear-gradient(45deg, hsl(var(--status-running)) 0 3px, transparent 3px 6px)';

interface NodeStatusRailProps {
  status: TNodeStatus;
  hasLoop?: boolean;
}

export const NodeStatusRail = ({ status, hasLoop }: NodeStatusRailProps) => {
  const striped = Boolean(hasLoop) || status === 'retrying';

  return (
    <span
      aria-hidden
      className={cn(
        'absolute left-0 top-0 h-full w-[3px]',
        !striped && NODE_STATUS_COLOR[status],
      )}
      style={striped ? { backgroundImage: LOOP_STRIPE } : undefined}
    />
  );
};
