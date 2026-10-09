import type {
  SessionMessageCompaction,
  SessionMessageShell,
  SessionMessageUser,
} from '@opencode/client';
import type { THistoryAttachment } from '../History.entity';

/**
 * Normalizadores de campos del SDK que no coinciden 1:1 con los view-models del
 * histórico: adjuntos de usuario (FR-007), `exit` de shell y `summary` de
 * compactación. Aíslan las rarezas del SDK del resto de los builders.
 */

/** Adjuntos de un prompt de usuario, normalizados por tipo y nombre (FR-007). */
export function toAttachments(info: SessionMessageUser): THistoryAttachment[] {
  const attachments: THistoryAttachment[] = [];
  for (const file of info.files ?? []) {
    attachments.push({ kind: 'file', name: file.name ?? null });
  }
  for (const agent of info.agents ?? []) {
    attachments.push({ kind: 'agent', name: agent.name ?? null });
  }
  for (const skill of info.skills ?? []) {
    attachments.push({ kind: 'skill', name: skill.name ?? null });
  }
  return attachments;
}

/** `exit` del SDK puede venir como sentinel no numérico; se normaliza a `null`. */
export function toExit(exit: SessionMessageShell['exit']): number | null {
  return typeof exit === 'number' ? exit : null;
}

/** Una compactación `failed` no trae `summary`; nunca se presenta como exitosa. */
export function toCompactionSummary(
  info: SessionMessageCompaction,
): string | null {
  return 'summary' in info ? info.summary : null;
}
