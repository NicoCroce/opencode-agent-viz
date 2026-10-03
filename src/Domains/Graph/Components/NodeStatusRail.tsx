import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '../Graph.entity';

const RAIL_COLOR: Record<TNodeStatus, string> = {
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  done: 'bg-status-done',
  error: 'bg-status-error',
  idle: 'bg-status-idle',
};

interface NodeStatusRailProps {
  status: TNodeStatus;
  hasLoop?: boolean;
}

export const NodeStatusRail = ({ status, hasLoop }: NodeStatusRailProps) => (
  <span
    aria-hidden
    className={cn(
      'absolute left-0 top-0 h-full w-[3px]',
      !hasLoop && RAIL_COLOR[status],
    )}
    style={
      hasLoop
        ? {
            backgroundImage:
              'repeating-linear-gradient(45deg, hsl(var(--status-error)) 0 3px, transparent 3px 6px)',
          }
        : undefined
    }
  />
);
