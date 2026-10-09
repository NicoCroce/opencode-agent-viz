import { useMemo } from 'react';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryEntry } from '../../History/History.entity';
import { buildHistory } from '../../History/lib/buildHistory';
import type {
  TQuestionEntry,
  TTaskEntry,
  TToolHistoryEntry,
} from '../Inspector.entity';
import { deriveTasks } from '../lib/deriveTasks';
import { errorsFromMessages } from '../lib/errorsFromMessages';
import { isToolPart, toolsFromMessages } from '../lib/toolsFromMessages';

export interface InspectorDerivations {
  tools: TToolHistoryEntry[];
  tasks: TTaskEntry[];
  errors: { message: string; at: number }[];
  /** Nombres únicos de las herramientas usadas en la sesión. */
  toolsUsed: string[];
  /** Entradas del histórico (respuestas, razonamiento, herramientas, …) en orden. */
  entries: THistoryEntry[];
}

/**
 * Derivaciones puras de los mensajes de la sesión (FR-033/FR-036): histórico de
 * herramientas, tareas de subagentes, errores, herramientas únicas y el
 * histórico completo, con las preguntas ancladas a su tool call.
 */
export const useInspectorDerivations = (
  messages: TSessionMessage[],
  questions: TQuestionEntry[],
): InspectorDerivations => {
  const tools = useMemo(() => toolsFromMessages(messages), [messages]);
  const tasks = useMemo(() => deriveTasks(messages), [messages]);
  const errors = useMemo(() => errorsFromMessages(messages), [messages]);

  // Las preguntas se incorporan al histórico ancladas a su tool call (FR-033).
  const entries = useMemo(
    () => buildHistory(messages, { questions }),
    [messages, questions],
  );

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

  return { tools, tasks, errors, toolsUsed, entries };
};
