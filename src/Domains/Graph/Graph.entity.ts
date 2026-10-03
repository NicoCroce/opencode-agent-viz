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

export interface TGraphNodeData extends Record<string, unknown> {
  sessionId: string;
  agentName: string;
  directory: string;
  model: ModelRef | null;
  status: TNodeStatus;
  metrics: TNodeMetrics;
  isRoot: boolean;
  currentTool: TCurrentTool | null;
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
