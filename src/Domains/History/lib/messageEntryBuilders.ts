import type { SessionMessageInfo } from '@opencode/client';
import type { TEntryBuilder } from './entryBuilders';
import { toCompactionSummary, toExit } from './normalizeSdkFields';

/**
 * Builders de mensaje "simples": un tipo de `SessionMessageInfo` → una única
 * entrada del histórico. Se separaron de `entryBuilders.ts` (que conserva el
 * registro exhaustivo `MESSAGE_ENTRY_BUILDERS`, el builder del assistant y el
 * del usuario) para respetar el límite de ~140 líneas por pieza.
 */

/** `Extract` de la variante de `info` para un `type` dado. */
type TInfoOf<K extends SessionMessageInfo['type']> = Extract<
  SessionMessageInfo,
  { type: K }
>;

/** Cambio de agente (`SessionMessageAgentSelected`). */
export const toAgentSwitchedEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'agent-switched'>;
  return [
    {
      id,
      at,
      kind: 'agent-switched',
      agent: info.agent,
      previous: info.previous ?? null,
    },
  ];
};

/** Cambio de modelo (`SessionMessageModelSelected`). */
export const toModelSwitchedEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'model-switched'>;
  return [
    {
      id,
      at,
      kind: 'model-switched',
      model: info.model,
      previous: info.previous ?? null,
    },
  ];
};

/** Cambio de ubicación/directorio (`SessionMessageLocationSwitched`). */
export const toLocationSwitchedEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'location-switched'>;
  return [
    {
      id,
      at,
      kind: 'location-switched',
      directory: info.location.directory,
    },
  ];
};

/** Aviso de sistema (`SessionMessageSystem`). */
export const toSystemEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'system'>;
  return [
    {
      id,
      at,
      kind: 'system',
      text: info.text,
      description: info.description ?? null,
    },
  ];
};

/** Entrada sintética (`SessionMessageSynthetic`). */
export const toSyntheticEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'synthetic'>;
  return [
    {
      id,
      at,
      kind: 'synthetic',
      text: info.text,
      description: info.description ?? null,
    },
  ];
};

/** Activación de una skill (`SessionMessageSkill`). */
export const toSkillEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'skill'>;
  return [
    {
      id,
      at,
      kind: 'skill',
      skill: info.skill,
      name: info.name,
      text: info.text,
    },
  ];
};

/** Ejecución de shell (`SessionMessageShell`). */
export const toShellEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'shell'>;
  return [
    {
      id,
      at,
      kind: 'shell',
      command: info.command,
      status: info.status,
      exit: toExit(info.exit),
    },
  ];
};

/** Episodio de compactación de contexto (`SessionMessageCompaction`, FR-035). */
export const toCompactionEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'compaction'>;
  return [
    {
      id,
      at,
      kind: 'compaction',
      status: info.status,
      reason: info.reason,
      summary: toCompactionSummary(info),
    },
  ];
};

/** Cierre de turno con su resultado (`SessionMessageIdle`). */
export const toIdleEntry: TEntryBuilder = (message, at, id) => {
  const info = message.info as TInfoOf<'idle'>;
  return [{ id, at, kind: 'idle', outcome: info.outcome }];
};
