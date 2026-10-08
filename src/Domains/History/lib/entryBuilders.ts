import type {
  SessionMessageInfo,
  SessionMessageUser,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryEntry } from '../History.entity';
import { toAssistantEntries } from './assistantParts';
import {
  toAgentSwitchedEntry,
  toCompactionEntry,
  toIdleEntry,
  toLocationSwitchedEntry,
  toModelSwitchedEntry,
  toShellEntry,
  toSkillEntry,
  toSyntheticEntry,
  toSystemEntry,
} from './messageEntryBuilders';
import { toAttachments } from './normalizeSdkFields';

/**
 * Registro exhaustivo de builders de mensaje. Tipar `MESSAGE_ENTRY_BUILDERS`
 * como `Record<SessionMessageInfo['type'], TEntryBuilder>` hace que el
 * compilador **exija** cobertura de todas las variantes: agregar un tipo nuevo
 * al SDK rompe la compilación hasta que se provea su builder.
 *
 * Los builders "simples" viven en `messageEntryBuilders.ts`; aquí quedan el
 * contrato, el builder del assistant y el registro.
 */

/**
 * Contrato de un builder de mensaje: proyecta un mensaje normalizado del SDK en
 * una o más entradas del histórico. `at` es `info.time.created` e `id` es
 * `${info.id}:0`, calculados por la fachada `buildHistory`.
 */
export type TEntryBuilder = (
  message: TSessionMessage,
  at: number,
  id: string,
) => THistoryEntry[];

/** Proyecta las partes del assistant en su orden de producción (FR-003). */
const toAssistantEntry: TEntryBuilder = (message, at, _id) =>
  toAssistantEntries(
    message.info as Extract<SessionMessageInfo, { type: 'assistant' }>,
    message.parts,
    at,
  );

/** Prompt del usuario, con sus adjuntos normalizados (FR-007). */
const toUserEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as SessionMessageUser;
  return [
    {
      id,
      at,
      kind: 'user',
      text: info.text,
      attachments: toAttachments(info),
    },
  ];
};

export const MESSAGE_ENTRY_BUILDERS: Record<
  SessionMessageInfo['type'],
  TEntryBuilder
> = {
  assistant: toAssistantEntry,
  user: toUserEntry,
  'agent-switched': toAgentSwitchedEntry,
  'model-switched': toModelSwitchedEntry,
  'location-switched': toLocationSwitchedEntry,
  system: toSystemEntry,
  synthetic: toSyntheticEntry,
  skill: toSkillEntry,
  shell: toShellEntry,
  compaction: toCompactionEntry,
  idle: toIdleEntry,
};
