import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { NODE_STATUS_COLOR } from '@app/Application/Helpers/nodeStatusColor';
import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Punto de color por estado (FR-017, 9 estados). El mapa de color es la fuente
 * única `NODE_STATUS_COLOR` (SH-03), compartida con `NodeStatusRail` y el punto
 * del gutter, para que todas las vistas coincidan (FR-023); la etiqueta legible
 * sigue siendo `NODE_STATUS_LABEL`. Ver
 * `contracts/execution-state-contract.md`.
 */
interface StatusDotProps {
  status: TNodeStatus;
  className?: string;
}

export const StatusDot = ({ status, className }: StatusDotProps) => (
  <span
    role="img"
    aria-label={NODE_STATUS_LABEL[status]}
    title={NODE_STATUS_LABEL[status]}
    className={cn('inline-block size-2 shrink-0 rounded-full', NODE_STATUS_COLOR[status], className)}
  />
);
