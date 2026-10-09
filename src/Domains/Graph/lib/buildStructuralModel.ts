import type { AgentInfo, SessionInfo, SessionStatus } from '@opencode/client';
import { EMPTY_METRICS, type TActivityMap, type TGraphModel } from '../Graph.entity';
import { buildGraph } from './buildGraph';

export interface BuildStructuralModelInput {
  /** Subárbol visible de sesiones (`filterSubtree`). */
  sessions: SessionInfo[];
  statuses: Record<string, SessionStatus>;
  agents: AgentInfo[];
  /**
   * Marca de última actividad observada por sesión
   * (`queryKeys.sessions.activity()`); se reenvía a `buildGraph` para ampliar el
   * fin del intervalo (`updatedAt = max(lista, actividad)`, contract
   * session-activity §4). **Opcional**: sin marca, la fase estructural cae a
   * `SessionInfo.time`.
   */
  activity?: TActivityMap;
  /** Reloj estable de la fase estructural (no avanza por tick). */
  now: number;
}

/**
 * Modelo **estructural** del grafo (contrato de carga §1.1, data-model §3): la
 * primera fase del modelo por fases. Deriva los nodos **sin contenido**
 * (mensajes/log/permisos/formularios/inbox vacíos) y con `enrichment: 'pending'`,
 * de modo que el grafo se pinta sin esperar al volumen de contenido (FR-010,
 * SC-007, criterio L4).
 *
 * `buildGraph` con contenido vacío ya produce métricas vacías salvo por el
 * `retryCount`/`loopEvidence` derivados del `SessionStatus` retry; se fija
 * `EMPTY_METRICS` para que la fase estructural sea exactamente vacía.
 */
export const buildStructuralModel = ({
  sessions,
  statuses,
  agents,
  activity,
  now,
}: BuildStructuralModelInput): TGraphModel => {
  const structural = buildGraph({
    sessions,
    statuses,
    agents,
    // Sin contenido: la estructura no depende de mensajes/log/permisos/etc.
    messages: {},
    permissions: [],
    signals: {},
    forms: [],
    inbox: [],
    enrichment: 'pending',
    activity,
    now,
  });
  return {
    ...structural,
    nodes: structural.nodes.map((node) => ({
      ...node,
      data: { ...node.data, metrics: EMPTY_METRICS },
    })),
  };
};
