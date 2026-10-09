import type {
  SessionMessageAssistantTool,
  ToolContent,
} from '@opencode/client';
import type { TToolEntry } from '../History.entity';

/**
 * Proyección de una llamada a herramienta (`SessionMessageAssistantTool`) al
 * view-model `TToolEntry`. Refleja el estado real y nunca inventa un resultado
 * cuando todavía no terminó (FR-004/FR-011).
 */
export function toToolEntry(part: SessionMessageAssistantTool): TToolEntry {
  const { state, time } = part;
  const startedAt = time.created;
  const completedAt = time.completed ?? null;
  const durationMs = completedAt !== null ? completedAt - startedAt : null;

  let result: string | null = null;
  let error: string | null = null;
  if (state.status === 'completed') {
    result = toolContentToText(state.content);
  } else if (state.status === 'error') {
    error = state.error.message;
    if (state.content) {
      result = toolContentToText(state.content);
    }
  }

  return {
    id: part.id,
    name: part.name,
    status: state.status,
    input: state.input,
    result,
    error,
    startedAt,
    completedAt,
    durationMs,
  };
}

/** Serializa el contenido de un resultado de herramienta a texto plano. */
export function toolContentToText(content: readonly ToolContent[]): string {
  return content
    .map((item) => (item.type === 'text' ? item.text : item.name ?? item.uri))
    .join('\n');
}
