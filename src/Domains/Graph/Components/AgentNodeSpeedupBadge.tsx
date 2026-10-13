import { formatSpeedup } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TNodeSpeedup } from '../Graph.entity';

interface AgentNodeSpeedupBadgeProps {
  /** Aceleración del grupo paralelo del nodo; `null` si corrió solo. */
  speedup: TNodeSpeedup | null;
}

/**
 * Badge de aceleración real por paralelismo (FR-009; `parallel-speedup-contract`
 * §4). Muestra `×N` (una cifra) cuando el grupo tiene aceleración calculable. Un
 * grupo aún en curso (`provisional`) antepone `~` y atenúa la marca: la
 * provisionalidad no depende solo del color, viaja también en el texto y en la
 * etiqueta accesible. No añade filas al card (`cardHeight`).
 */
export const AgentNodeSpeedupBadge = ({
  speedup,
}: AgentNodeSpeedupBadgeProps) => {
  if (!speedup || speedup.speedup === null) return null;

  const value = formatSpeedup(speedup.speedup);
  const label = speedup.provisional
    ? `Aceleración ${value} (provisional)`
    : `Aceleración ${value}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="node-speedup"
      className={cn(
        'rounded-flat border px-1 font-mono text-[10px] leading-4',
        speedup.provisional
          ? 'border-dashed border-foreground/30 text-muted-foreground'
          : 'border-status-done/60 text-status-done',
      )}
    >
      {speedup.provisional ? `~${value}` : value}
    </span>
  );
};
