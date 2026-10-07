import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '../Graph.entity';

/**
 * Tono de la franja por estado (FR-017). Reutiliza los tokens semánticos
 * existentes: reintentando/compactando usan el tono `running`; esperando
 * respuesta/permiso, `waiting`; interrumpido comparte `error` pero nunca se
 * confunde con un fallo propio (FR-019).
 */
const RAIL_COLOR: Record<TNodeStatus, string> = {
  created: 'bg-status-idle',
  running: 'bg-status-running',
  retrying: 'bg-status-running',
  compacting: 'bg-status-running',
  'waiting-permission': 'bg-status-waiting',
  'waiting-input': 'bg-status-waiting',
  succeeded: 'bg-status-done',
  failed: 'bg-status-error',
  interrupted: 'bg-status-error',
};

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
        !striped && RAIL_COLOR[status],
      )}
      style={striped ? { backgroundImage: LOOP_STRIPE } : undefined}
    />
  );
};
