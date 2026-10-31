import { StatusDot } from '@app/Application/Components';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { NODE_STATUS_TEXT_COLOR } from '../lib/sessionRow';

interface SessionStatusLabelProps {
  status: TNodeStatus;
  /** LED encendido: el punto lleva el halo del acento. */
  isLive: boolean;
}

/**
 * Estado de una sesión en la tabla: punto + etiqueta mono en versalitas, ambos
 * en el color del estado. El nombre accesible lo aporta el `StatusDot`
 * (`role="img"`); la etiqueta visible se oculta a lectores para no duplicarlo.
 */
export const SessionStatusLabel = ({
  status,
  isLive,
}: SessionStatusLabelProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-[7px] font-mono text-[11px] uppercase tracking-[0.06em]',
      NODE_STATUS_TEXT_COLOR[status],
    )}
  >
    <StatusDot status={status} className={cn(isLive && 'glow-accent')} />
    <span aria-hidden>{NODE_STATUS_LABEL[status]}</span>
  </span>
);
