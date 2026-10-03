import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TTaskEntry } from '../Inspector.entity';

/**
 * Tools que abren una sesión hija. `subagent` es el nativo de V2;
 * `task` aparece en el historial escrito por versiones anteriores.
 */
const SUBAGENT_TOOLS = new Set(['subagent', 'task']);

const MAX_FALLBACK_DESCRIPTION = 120;

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * El input del tool llega como texto plano mientras se transmite y como objeto
 * una vez ejecutado; normalizamos ambos casos.
 */
const toolInput = (state: {
  status: string;
  input: unknown;
}): Record<string, unknown> =>
  state.status === 'streaming' ? {} : asObject(state.input);

/**
 * `metadata.sessionID` es el vinculo con la sesion hija que abrio el subagente.
 */
const toolMetadata = (state: { status: string; metadata?: unknown }) =>
  state.status === 'streaming' ? {} : asObject(state.metadata);

/**
 * Deriva las tareas del subagente desde los tool calls del contexto de la
 * sesion. Reemplaza a los todos de V1, que V2 elimino por completo.
 */
export const deriveTasks = (
  messages: TSessionMessage[],
): TTaskEntry[] => {
  const entries: TTaskEntry[] = [];

  for (const { parts } of messages) {
    for (const part of parts) {
      if (part.type !== 'tool') continue;
      if (!SUBAGENT_TOOLS.has(part.name)) continue;

      const input = toolInput(part.state);
      const metadata = toolMetadata(part.state);
      const prompt = asString(input.prompt);

      entries.push({
        id: part.id,
        description:
          asString(input.description) ??
          (prompt ? prompt.slice(0, MAX_FALLBACK_DESCRIPTION) : part.name),
        agent: asString(input.agent) ?? asString(input.subagent_type),
        status: part.state.status,
        sessionID: asString(metadata.sessionID),
        startedAt: part.time.created,
        endedAt: part.time.completed,
      });
    }
  }

  return entries;
};
