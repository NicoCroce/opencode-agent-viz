import type {
  AgentInfo,
  PermissionRequest,
  SessionInfo,
  SessionStatus,
} from '@opencode/client';
import type { TGraphEdge, TGraphModel, TGraphNode } from '../Graph.entity';
import { deriveMetrics, type TSessionMessageLike } from './deriveMetrics';
import { toNodeStatus } from './nodeStatus';

export interface BuildGraphInput {
  sessions: SessionInfo[];
  statuses: Record<string, SessionStatus>;
  agents: AgentInfo[];
  messages: Record<string, TSessionMessageLike[]>;
  permissions: PermissionRequest[];
  now: number;
}

const resolveModel = (
  messages: TSessionMessageLike[] | undefined,
): TGraphNode['data']['model'] => {
  if (!messages) return null;
  for (const { info } of messages) {
    if (info.type === 'assistant') return info.model;
  }
  return null;
};

const hasError = (messages: TSessionMessageLike[] | undefined): boolean => {
  if (!messages) return false;
  return messages.some(({ info, parts }) => {
    if (info.type === 'assistant' && info.error) return true;
    return parts.some((p) => p.type === 'tool' && p.state.status === 'error');
  });
};

const currentTool = (
  messages: TSessionMessageLike[] | undefined,
): { name: string; state: string } | null => {
  if (!messages) return null;
  let found: { name: string; state: string } | null = null;
  for (const { parts } of messages) {
    for (const part of parts) {
      if (part.type !== 'tool') continue;
      found = { name: part.name, state: part.state.status };
    }
  }
  return found;
};

export const buildGraph = ({
  sessions,
  statuses,
  agents,
  messages,
  permissions,
  now,
}: BuildGraphInput): TGraphModel => {
  const nodes: TGraphNode[] = sessions.map((session) => {
    const sessionMessages = messages[session.id];
    const permission = permissions.some((p) => p.sessionID === session.id);
    const error = hasError(sessionMessages);

    // V2 expone el agente en `SessionInfo.agent`; antes habia que deducirlo del
    // primer mensaje de usuario.
    const agentName =
      session.agent ?? (session.parentID === undefined ? 'root' : 'subagent');
    const agent = agents.find((a) => a.id === agentName);

    const metrics = deriveMetrics({
      messages: sessionMessages ?? [],
      status: statuses[session.id],
      now,
    });

    return {
      id: session.id,
      type: 'agent' as const,
      position: { x: 0, y: 0 },
      data: {
        sessionId: session.id,
        title: session.title ?? null,
        createdAt: session.time.created,
        updatedAt: session.time.idle ?? session.time.updated,
        agentName,
        directory: session.location.directory,
        model: resolveModel(sessionMessages) ?? agent?.model ?? null,
        status: toNodeStatus({
          status: statuses[session.id],
          hasActivity: (sessionMessages?.length ?? 0) > 0,
          hasPermission: permission,
          hasError: error,
        }),
        metrics,
        isRoot: session.parentID === undefined,
        currentTool: currentTool(sessionMessages),
        // El paralelismo es una propiedad de la vista (depende del subárbol y
        // de `now`); se completa en `useGraphModel`.
        parallel: null,
      },
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: TGraphEdge[] = sessions
    .filter((s) => s.parentID !== undefined && nodeIds.has(s.parentID))
    .map((s) => ({
      id: `${s.parentID}->${s.id}`,
      source: s.parentID as string,
      target: s.id,
      type: 'agent' as const,
    }));

  return { nodes, edges };
};
