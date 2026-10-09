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
  /** Nodo activo (`isActiveStatus`); habilita el barrido del rail. */
  active: boolean;
  hasLoop?: boolean;
}

export const NodeStatusRail = ({ status, active, hasLoop }: NodeStatusRailProps) => {
  const striped = Boolean(hasLoop) || status === 'retrying';
  // El rayado es la firma de loop/reintento y gana al barrido: solo un activo
  // sin rayar muestra la animación "pensando" (FR-002/FR-004).
  const scanning = active && !striped;

  return (
    <span
      aria-hidden
      data-testid="node-status-rail"
      className={cn(
        // Hairline discreto: 2 px y algo rebajado, para que el estado no pese
        // más que el título (el punto del encabezado da la lectura precisa).
        'absolute left-0 top-0 h-full w-[2px] opacity-[0.72]',
        !striped && NODE_STATUS_COLOR[status],
        scanning && 'rail-scan',
      )}
      style={striped ? { backgroundImage: LOOP_STRIPE } : undefined}
    />
  );
};
