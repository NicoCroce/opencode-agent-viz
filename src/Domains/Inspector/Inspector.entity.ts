import type { McpServer } from '@opencode/client';
import type { TGraphNode, TNodeMetrics } from '../Graph/Graph.entity';

/** `McpServer.status` es una unión discriminada por `status`. */
export type TMcpStatus = McpServer['status']['status'];

export interface TResourceUsage {
  mcpServers: { name: string; status: TMcpStatus }[];
  instructions: string[];
  skills: { name: string }[];
  tools: string[];
  availability: 'available';
}

export interface TToolHistoryEntry {
  name: string;
  status: string;
  startedAt?: number;
  endedAt?: number;
}

/**
 * V2 eliminó la API de todos de sesión (`session.todo` y el evento
 * `todo.updated` no existen). En su lugar derivamos las tareas del subagente
 * de los tool calls que abren una sesión hija.
 */
export interface TTaskEntry {
  id: string;
  description: string;
  agent: string | null;
  status: string;
  /** Sesión hija que el subagente abrió, cuando el server la reporta. */
  sessionID: string | null;
  startedAt?: number;
  endedAt?: number;
}

export interface TNodeDetail {
  node: TGraphNode;
  metrics: TNodeMetrics;
  tools: TToolHistoryEntry[];
  tasks: TTaskEntry[];
  errors: { message: string; at: number }[];
  resources: TResourceUsage;
}

export interface TSessionSummary {
  rootSessionId: string;
  metrics: TNodeMetrics;
  agentCount: number;
  subagentCount: number;
  runningCount: number;
  waitingCount: number;
  errorCount: number;
  loopCount: number;
  agentInvocations: Record<string, number>;
  resourceUsage: TResourceUsage;
}
