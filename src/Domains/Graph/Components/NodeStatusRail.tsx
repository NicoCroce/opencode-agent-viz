import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '../Graph.entity';
import { NODE_CARD_TONE } from './nodeCardTone';

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
  const tone = NODE_CARD_TONE[status];

  return (
    <span
      aria-hidden
      data-testid="node-status-rail"
      className={cn(
        // Barra de estado de 2 px a todo el ancho del borde superior (diseño
        // "minimal-futurista"), a opacidad plena; la actividad suma el halo del
        // acento. Es absoluta: no ocupa alto de flujo (`cardHeight` no cambia).
        'absolute inset-x-0 top-0 h-[2px] rounded-t-[9px]',
        !striped && tone.rail,
        !striped && tone.glow && 'glow-accent',
        // `.rail-scan` conserva el contrato del barrido y su respaldo estático
        // con `prefers-reduced-motion`; el keyframe actual es vertical, así que
        // sobre la barra horizontal queda prácticamente estático.
        scanning && 'rail-scan',
      )}
      style={striped ? { backgroundImage: LOOP_STRIPE } : undefined}
    />
  );
};
