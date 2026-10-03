import { cn } from '@app/Application/lib/utils';
import { StatusDot } from '@app/Application/Components';
import { toNodeStatus } from '@app/Domains/Graph/lib/nodeStatus';
import type { TSessionStatus } from '../Session.entity';
import type { TRootSessionItem } from '../Hooks/useRootSessions';

interface SessionCardProps {
  item: TRootSessionItem;
  status?: TSessionStatus;
  selected: boolean;
  onSelect: (id: string) => void;
}

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

export const SessionCard = ({
  item,
  status,
  selected,
  onSelect,
}: SessionCardProps) => {
  const { session, agentName } = item;
  const nodeStatus = toNodeStatus({
    status,
    hasActivity: true,
    hasPermission: false,
    hasError: false,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      aria-current={selected}
      className={cn(
        'flex w-full flex-col gap-1 rounded-flat border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-accent bg-surface-2'
          : 'border-border bg-surface-1 hover:bg-surface-2',
      )}
    >
      <span className="flex items-center gap-2">
        <StatusDot status={nodeStatus} />
        <span className="truncate font-mono text-xs text-muted-foreground">
          {agentName ?? 'agent'}
        </span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatTime(session.time.updated)}
        </span>
      </span>
      <span className="truncate text-sm font-medium text-foreground">
        {session.title}
      </span>
    </button>
  );
};
