import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  opencodeService,
  type TContentPart,
  type TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../queryKeys';
import type { TGraphNode } from '../../Graph/Graph.entity';
import type { TResourceUsage, TToolHistoryEntry } from '../Inspector.entity';
import { deriveTasks } from '../lib/deriveTasks';
import { useGetInstructions, useGetMcpServers } from '../Inspector.service';

type TToolPart = Extract<TContentPart, { type: 'tool' }>;

const isToolPart = (part: TContentPart): part is TToolPart =>
  part.type === 'tool';

const toolsFromMessages = (messages: TSessionMessage[]): TToolHistoryEntry[] =>
  messages.flatMap(({ parts }) =>
    parts.filter(isToolPart).map((part) => ({
      name: part.name,
      status: part.state.status,
      startedAt: part.time.created,
      endedAt: part.time.completed,
    })),
  );

const errorsFromMessages = (
  messages: TSessionMessage[],
): { message: string; at: number }[] => {
  const errors: { message: string; at: number }[] = [];
  for (const { info, parts } of messages) {
    if (info.type === 'assistant' && info.error) {
      errors.push({ message: info.error.message, at: info.time.created });
    }
    for (const part of parts.filter(isToolPart)) {
      if (part.state.status !== 'error') continue;
      errors.push({
        message: part.state.error.message,
        at: part.time.completed ?? part.time.created,
      });
    }
  }
  return errors;
};

export interface InspectorData {
  tools: TToolHistoryEntry[];
  tasks: ReturnType<typeof deriveTasks>;
  errors: { message: string; at: number }[];
}

export const useInspectorData = (node: TGraphNode | null) => {
  const sessionId = node?.data.sessionId ?? null;
  const directory = node?.data.directory ?? null;

  const messagesQuery = useQuery({
    queryKey: queryKeys.sessions.messages(sessionId ?? 'none'),
    queryFn: () => opencodeService.getSessionMessages(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });

  const mcpQuery = useGetMcpServers(directory);
  const instructionsQuery = useGetInstructions(sessionId);

  const messages = useMemo(
    () => messagesQuery.data ?? [],
    [messagesQuery.data],
  );

  const tools = useMemo(() => toolsFromMessages(messages), [messages]);
  const tasks = useMemo(() => deriveTasks(messages), [messages]);
  const errors = useMemo(() => errorsFromMessages(messages), [messages]);

  // Herramientas usadas en la sesión (no solo la actual): nombres únicos.
  const toolsUsed = useMemo(
    () => [
      ...new Set(
        messages.flatMap(({ parts }) =>
          parts.filter(isToolPart).map((part) => part.name),
        ),
      ),
    ],
    [messages],
  );

  const resources: TResourceUsage = useMemo(
    () => ({
      mcpServers: (mcpQuery.data ?? []).map((server) => ({
        name: server.name,
        status: server.status.status,
      })),
      // Las instrucciones son entries por sesión en V2, no una lista global
      // en el config como en V1.
      instructions: (instructionsQuery.data ?? []).map((entry) => entry.key),
      skills: [],
      tools: toolsUsed,
      availability: 'available',
    }),
    [mcpQuery.data, instructionsQuery.data, toolsUsed],
  );

  return { tools, tasks, errors, resources };
};
