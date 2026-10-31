import { cn } from '@app/Application/lib/utils';
import { useConnectionStatus } from '../Hooks/useConnectionStatus';
import { CONNECTION_LABEL, type TConnectionState } from '../Connection.entity';

/** Conectado = el acento cyan con halo (señal de "en vivo"); el resto, su LED. */
const DOT_COLOR: Record<TConnectionState, string> = {
  connected: 'bg-accent glow-accent',
  reconnecting: 'bg-status-waiting',
  disconnected: 'bg-status-error',
};

export const ConnectionBadge = () => {
  const { state } = useConnectionStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-8 items-center gap-2 rounded-full border border-border bg-surface-0 px-3"
    >
      <span className={cn('size-1.5 rounded-full', DOT_COLOR[state])} />
      <span className="font-mono text-[11px] text-muted-foreground">
        {CONNECTION_LABEL[state]}
      </span>
    </div>
  );
};
