import { cn } from '@app/Application/lib/utils';
import { StatusDot } from '@app/Application/Components';
import { formatDateTimeRange } from '@app/Application/Helpers';
import type { TSessionStatus } from '../Session.entity';
import type { TRootSessionItem } from '../Hooks/useRootSessions';
import { useSessionNodeStatus } from '../Hooks/useSessionNodeStatus';

interface SessionCardProps {
  item: TRootSessionItem;
  status?: TSessionStatus;
  /**
   * Estado de ejecución ya derivado (presentación pura). Si se omite, se deriva
   * de `status` con `useSessionNodeStatus` (el cross-domain vive en el hook,
   * AGENTS §8.3).
   */
  nodeStatus?: ReturnType<typeof useSessionNodeStatus>;
  selected: boolean;
  onSelect: (id: string) => void;
}

export const SessionCard = ({
  item,
  status,
  nodeStatus,
  selected,
  onSelect,
}: SessionCardProps) => {
  const { session, agentName } = item;
  const derivedNodeStatus = useSessionNodeStatus(status);
  const resolvedNodeStatus = nodeStatus ?? derivedNodeStatus;
  const timeRange = formatDateTimeRange({
    startedAt: session.time.created,
    endedAt: session.time.updated,
    isRunning: status?.type === 'busy' || status?.type === 'retry',
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
        <StatusDot status={resolvedNodeStatus} />
        <span className="truncate text-sm font-medium text-foreground">
          {session.title}
        </span>
      </span>
      <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
        {timeRange}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {agentName ?? 'agente no disponible'}
      </span>
    </button>
  );
};
