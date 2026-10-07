import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Color y etiqueta por estado (FR-017, 9 estados). Se reutilizan los tokens
 * semánticos existentes (plan.md): reintentando/compactando → `running`;
 * esperando permiso/respuesta → `waiting`; interrumpido comparte el tono
 * `error` pero con etiqueta propia ("Interrumpido"), nunca confundido con un
 * fallo propio (FR-019). Ver `contracts/execution-state-contract.md`.
 */
const STATUS_COLOR: Record<TNodeStatus, string> = {
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

interface StatusDotProps {
  status: TNodeStatus;
  className?: string;
}

export const StatusDot = ({ status, className }: StatusDotProps) => (
  <span
    role="img"
    aria-label={NODE_STATUS_LABEL[status]}
    title={NODE_STATUS_LABEL[status]}
    className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_COLOR[status], className)}
  />
);
