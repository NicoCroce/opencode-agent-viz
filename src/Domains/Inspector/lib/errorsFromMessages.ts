import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { isToolPart } from './toolsFromMessages';

/**
 * Deriva los errores de la sesión: los del mensaje assistant (`info.error`) y
 * los de cada tool call fallida (`state.status === 'error'`), con su timestamp.
 */
export const errorsFromMessages = (
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
