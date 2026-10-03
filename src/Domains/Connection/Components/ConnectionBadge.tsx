import { cn } from '@app/Application/lib/utils';
import { useConnectionStatus } from '../Hooks/useConnectionStatus';
import { CONNECTION_LABEL, type TConnectionState } from '../Connection.entity';

const DOT_COLOR: Record<TConnectionState, string> = {
  connected: 'bg-status-done',
  reconnecting: 'bg-status-waiting',
  disconnected: 'bg-status-error',
};

export const ConnectionBadge = () => {
  const { state } = useConnectionStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-flat border border-border bg-surface-2 px-2.5 py-1"
    >
      <span className={cn('size-2 rounded-full', DOT_COLOR[state])} />
      <span className="text-xs font-medium text-foreground">
        {CONNECTION_LABEL[state]}
      </span>
    </div>
  );
};
