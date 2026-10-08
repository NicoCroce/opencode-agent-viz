import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { toNodeStatus } from '@app/Domains/Graph/lib/nodeStatus';
import type { TSessionStatus } from '../Session.entity';

/**
 * Deriva el `TNodeStatus` de una sesión raíz para el `StatusDot` de
 * `SessionCard` (FR-017..FR-023).
 *
 * El acceso cross-domain a `Graph/lib/nodeStatus` vive aquí, en un hook del
 * dominio Sessions (AGENTS §8.3), nunca en el componente. La lista de sesiones
 * raíz no carga permisos, formularios ni señales de ejecución por sesión; el
 * estado se deriva solo de `SessionStatus` y de si hubo actividad (los 9 estados
 * se detallan en el grafo/inspector).
 */
export const useSessionNodeStatus = (status?: TSessionStatus): TNodeStatus =>
  toNodeStatus({
    status,
    hasActivity: true,
    hasPermission: false,
    hasPendingForm: false,
    compaction: null,
    outcome: null,
    lastAssistantErrored: false,
  });
