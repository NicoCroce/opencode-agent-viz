import { cn } from '@app/Application/lib/utils';
import { useConnectionStatus } from '../Hooks/useConnectionStatus';
import { CONNECTION_LABEL, type TConnectionState } from '../Connection.entity';

const DOT_COLOR: Record<TConnectionState, string> = {
  connected: 'bg-status-done',
  reconnecting: 'bg-status-waiting',
  disconnected: 'bg-status-error',
};

/**
 * Estado del canal en una cápsula de instrumento: el punto es la señal y la
 * etiqueta textual es la fuente accesible (el color por sí solo no comunica).
 */
export const ConnectionBadge = () => {
  const { state } = useConnectionStatus();
  const connected = state === 'connected';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-1/60 py-1 pl-2.5 pr-3"
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          DOT_COLOR[state],
          connected && 'live-pulse',
        )}
      />
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {CONNECTION_LABEL[state]}
      </span>
    </div>
  );
};
