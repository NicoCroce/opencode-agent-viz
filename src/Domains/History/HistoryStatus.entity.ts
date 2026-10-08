import type {
  SessionMessageCompaction,
  SessionMessageShell,
} from '@opencode/client';
import type { TOutcome } from '@app/Application/Helpers/outcomeLabel';

/**
 * Estados del SDK proyectados por el histórico (Constitución IV: prefijo `T`).
 *
 * Los estados de herramienta, compactación y shell reflejan el estado real de
 * las partes del SDK y nunca inventan un resultado (FR-004/FR-011).
 * `TIdleOutcome` es un alias de `TOutcome` (`Application/Helpers/outcomeLabel`),
 * la unión terminal compartida con Graph (Familia 8 / SH-04).
 */

/** Estado real de una llamada a herramienta (`SessionMessageAssistantTool`). */
export type TToolStatus = 'streaming' | 'running' | 'completed' | 'error';

/** Estado de un episodio de compactación (`SessionMessageCompaction`). */
export type TCompactionStatus = 'running' | 'completed' | 'failed';

/** Motivo de un episodio de compactación (`SessionMessageCompaction`). */
export type TCompactionReason = SessionMessageCompaction['reason'];

/** Resultado final de un turno (`SessionMessageIdle`); alias de `TOutcome`. */
export type TIdleOutcome = TOutcome;

/** Estado de un mensaje `shell` (`SessionMessageShell`). */
export type TShellStatus = SessionMessageShell['status'];
