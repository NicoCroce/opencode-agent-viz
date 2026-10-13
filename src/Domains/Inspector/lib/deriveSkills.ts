import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TSkillUsage } from '../InspectorResources.entity';
import type { TToolPart } from './toolsFromMessages';
import { isToolPart } from './toolsFromMessages';

/** Nombre del tool con el que OpenCode carga una skill. */
const SKILL_TOOL = 'skill';

/** Orden de magnitud de la estimación de tokens (FR-009): caracteres ÷ 4. */
const CHARS_PER_TOKEN = 4;

export type { TSkillUsage };

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Tokens estimados de **una** carga: caracteres de `content[].text` ÷ 4. Las
 * repeticiones las lleva `count`, no la suma; sin texto (p. ej. solo un `file`)
 * la estimación es desconocida (`null`).
 */
const estTokensFrom = (state: TToolPart['state']): number | null => {
  if (!('content' in state) || !state.content) return null;

  const chars = state.content.reduce(
    (total, item) => (item.type === 'text' ? total + item.text.length : total),
    0,
  );

  return chars > 0 ? Math.round(chars / CHARS_PER_TOKEN) : null;
};

/**
 * Deriva las skills cargadas en la sesión desde los tool calls del contexto.
 * El nombre llega como `input.name` o `input.id` según el origen de los datos;
 * los tool fallidos (`state.status === 'error'`) no cuentan como cargados.
 */
export const deriveSkills = (messages: TSessionMessage[]): TSkillUsage[] => {
  const byName = new Map<string, TSkillUsage>();

  for (const { parts } of messages) {
    for (const part of parts.filter(isToolPart)) {
      if (part.name !== SKILL_TOOL) continue;
      if (part.state.status === 'error') continue;
      // Mientras se transmite el input es texto plano sin parsear: sin nombre.
      if (part.state.status === 'streaming') continue;

      const input = asObject(part.state.input);
      const name = asString(input.name) ?? asString(input.id);
      if (!name) continue;

      const loadedAt = part.time.created;
      const estTokens = estTokensFrom(part.state);
      const existing = byName.get(name);

      if (!existing) {
        byName.set(name, { name, count: 1, estTokens, firstLoadedAt: loadedAt });
        continue;
      }

      existing.count += 1;
      existing.firstLoadedAt = Math.min(existing.firstLoadedAt, loadedAt);
      existing.estTokens ??= estTokens;
    }
  }

  return [...byName.values()];
};
