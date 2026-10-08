import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';

/**
 * Color de fondo por los 9 estados de `TNodeStatus` (FR-017). Única fuente de
 * verdad compartida por `StatusDot`, `NodeStatusRail` y el punto del gutter de
 * `ExecutionLanes`, para que todas las vistas coincidan (FR-023). Reutiliza los
 * tokens semánticos existentes: reintentar/compactar comparten el tono `running`;
 * las dos esperas comparten `waiting`; interrumpido usa `error` con etiqueta
 * propia, nunca confundido con un fallo (FR-019).
 */
export const NODE_STATUS_COLOR: Record<TNodeStatus, string> = {
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
