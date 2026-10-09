import type { TLineageNav } from '@app/Domains/History';
import type { TResourceUsage } from '@app/Domains/Inspector';

/**
 * Pestañas del workspace (móvil). Extraídas a constantes para evitar magic
 * strings repetidos en el `useState` inicial, las comparaciones y el tablist
 * (AGENTS §8.5).
 */
export const WORKSPACE_TABS = ['sessions', 'graph', 'inspector'] as const;

export type TWorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** Linaje vacío: el nodo no tiene padre ni hijos en el grafo. */
export const EMPTY_LINEAGE: TLineageNav = { parentId: null, childrenIds: [] };

/**
 * Recursos de la sesión para el resumen (FR-024). El resumen de la cabecera del
 * grafo agrega contadores/coste/tokens/tiempo; el inventario de recursos se
 * muestra en el detalle del agente, así que aquí basta el marcador disponible.
 */
export const EMPTY_RESOURCE_USAGE: TResourceUsage = {
  mcpServers: [],
  instructions: [],
  skills: [],
  tools: [],
  availability: 'available',
};
