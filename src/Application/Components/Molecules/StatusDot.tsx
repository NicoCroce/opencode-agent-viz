import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

const STATUS_COLOR: Record<TNodeStatus, string> = {
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  done: 'bg-status-done',
  error: 'bg-status-error',
  idle: 'bg-status-idle',
};

const STATUS_LABEL: Record<TNodeStatus, string> = {
  running: 'En curso',
  waiting: 'Esperando permiso',
  done: 'Terminado',
  error: 'Error',
  idle: 'Inactivo',
};

interface StatusDotProps {
  status: TNodeStatus;
  className?: string;
}

export const StatusDot = ({ status, className }: StatusDotProps) => (
  <span
    role="img"
    aria-label={STATUS_LABEL[status]}
    title={STATUS_LABEL[status]}
    className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_COLOR[status], className)}
  />
);
