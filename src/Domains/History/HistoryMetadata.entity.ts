import type { ModelRef } from '@opencode/client';
import type {
  TCompactionReason,
  TCompactionStatus,
  TIdleOutcome,
  TShellStatus,
} from './HistoryStatus.entity';
import type { THistoryEntryBase } from './HistoryEntry.entity';

/**
 * Variantes no conversacionales del histórico (Constitución IV: prefijo `T`).
 *
 * Agrupa los eventos de metadata de una sesión —cambios de agente, modelo y
 * ubicación, avisos de sistema/sintéticos, skills, shell, compactación e idle—
 * que `THistoryEntry` une junto a las entradas del assistant (ver
 * `HistoryEntry.entity`). No dependen del SDK en runtime, solo de sus tipos.
 */

/** Cambio de agente (`SessionMessageAgentSelected`). */
export interface THistoryAgentSwitchedEntry extends THistoryEntryBase {
  kind: 'agent-switched';
  agent: string;
  previous: string | null;
}

/** Cambio de modelo (`SessionMessageModelSelected`). */
export interface THistoryModelSwitchedEntry extends THistoryEntryBase {
  kind: 'model-switched';
  model: ModelRef;
  previous: ModelRef | null;
}

/** Cambio de ubicación/directorio (`SessionMessageLocationSwitched`). */
export interface THistoryLocationSwitchedEntry extends THistoryEntryBase {
  kind: 'location-switched';
  directory: string;
}

/** Aviso de sistema (`SessionMessageSystem`). */
export interface THistorySystemEntry extends THistoryEntryBase {
  kind: 'system';
  text: string;
  description: string | null;
}

/** Entrada sintética (`SessionMessageSynthetic`). */
export interface THistorySyntheticEntry extends THistoryEntryBase {
  kind: 'synthetic';
  text: string;
  description: string | null;
}

/** Activación de una skill (`SessionMessageSkill`). */
export interface THistorySkillEntry extends THistoryEntryBase {
  kind: 'skill';
  skill: string;
  name: string;
  text: string;
}

/** Ejecución de shell (`SessionMessageShell`). */
export interface THistoryShellEntry extends THistoryEntryBase {
  kind: 'shell';
  command: string;
  status: TShellStatus;
  exit: number | null;
}

/** Episodio de compactación de contexto (`SessionMessageCompaction`, FR-035). */
export interface THistoryCompactionEntry extends THistoryEntryBase {
  kind: 'compaction';
  status: TCompactionStatus;
  reason: TCompactionReason;
  summary: string | null;
}

/** Cierre de turno con su resultado (`SessionMessageIdle`). */
export interface THistoryIdleEntry extends THistoryEntryBase {
  kind: 'idle';
  outcome: TIdleOutcome;
}
