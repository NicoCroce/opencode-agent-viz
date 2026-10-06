import type { ModelRef } from '@opencode/client';

export type TNodeStatus = 'idle' | 'running' | 'waiting' | 'error' | 'done';

export interface TTokenUsage {
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

export interface TNodeMetrics {
  durationMs: number | null;
  startedAt: number | null;
  endedAt: number | null;
  cost: number | null;
  tokens: TTokenUsage | null;
  invocations: number;
  retryCount: number;
  hasLoop: boolean;
  loopEvidence: string[];
}

export interface TCurrentTool {
  name: string;
  state: string;
}

/**
 * Grupo de agentes que corrieron en paralelo (intervalos de ejecución
 * solapados entre hermanos). Ver `lib/parallelism.ts`.
 */
export interface TParallelGroup {
  id: string;
  /** Sesión padre común a todos los miembros; `null` para raíces. */
  parentId: string | null;
  nodeIds: string[];
  startedAt: number;
  endedAt: number;
}

/** Resumen de paralelismo de un nodo, listo para la vista. */
export interface TNodeParallelism {
  groupId: string;
  /** Cantidad de agentes del grupo, incluido este nodo. */
  size: number;
}

export interface TGraphNodeData extends Record<string, unknown> {
  sessionId: string;
  /** Título de la tarea/sesión; reemplaza al agente en el nodo. */
  title: string | null;
  /**
   * `SessionInfo.time.created`: instante de creación de la sesión. Es estable
   * (no depende de que los mensajes hayan cargado) y ordena los niveles de
   * ejecución y las columnas dentro de un nivel.
   */
  createdAt: number | null;
  /**
   * `SessionInfo.time.idle ?? time.updated`: fin del intervalo de ejecución,
   * estable y disponible apenas cargan las sesiones. Cierra la detección de
   * solapamientos sin depender de los mensajes.
   */
  updatedAt: number | null;
  agentName: string;
  directory: string;
  model: ModelRef | null;
  status: TNodeStatus;
  metrics: TNodeMetrics;
  isRoot: boolean;
  currentTool: TCurrentTool | null;
  /** `null` cuando el nodo no corrió en paralelo con ningún hermano. */
  parallel: TNodeParallelism | null;
}

export interface TGraphNode {
  id: string;
  type: 'agent';
  position: { x: number; y: number };
  data: TGraphNodeData;
}

export interface TGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'agent';
}

export interface TGraphModel {
  nodes: TGraphNode[];
  edges: TGraphEdge[];
}

/**
 * Tamaño/posición elegidos por el usuario para un nodo, por sesión.
 * Estado de vista local: sin persistencia ni escritura en el servidor.
 */
export interface TNodeSizeOverride {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export const EMPTY_TOKEN_USAGE: TTokenUsage = {
  input: null,
  output: null,
  reasoning: null,
  cacheRead: null,
  cacheWrite: null,
};

export const EMPTY_METRICS: TNodeMetrics = {
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
};
