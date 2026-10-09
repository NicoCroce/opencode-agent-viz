import type { SessionInfo, SessionStatus } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TActivityMap, TExecutionSignal } from '../../Graph.entity';

export type TSessionMessageCache = TSessionMessage[];

export const messagesOf = (prev: unknown): TSessionMessage[] =>
  Array.isArray(prev) ? (prev as TSessionMessage[]) : [];

export const setStatus = (
  prev: unknown,
  sessionID: string,
  status: SessionStatus,
): Record<string, SessionStatus> => ({
  ...(prev !== null && typeof prev === 'object'
    ? (prev as Record<string, SessionStatus>)
    : {}),
  [sessionID]: status,
});

/**
 * Marca de actividad monótona (FR-009, contract session-activity §2): conserva
 * el máximo entre la marca previa y el instante del evento, sin mutar la
 * entrada. `{ ...prev, [sessionID]: Math.max(prev[sessionID] ?? 0, at) }`.
 */
export const setActivity = (
  prev: TActivityMap,
  sessionID: string,
  at: number,
): TActivityMap => ({
  ...prev,
  [sessionID]: Math.max(prev[sessionID] ?? 0, at),
});

export const removeSession = (prev: unknown, id: string): SessionInfo[] =>
  Array.isArray(prev) ? (prev as SessionInfo[]).filter((s) => s.id !== id) : [];

export const signalsOf = (prev: unknown): Record<string, TExecutionSignal> =>
  prev !== null && typeof prev === 'object'
    ? (prev as Record<string, TExecutionSignal>)
    : {};

export const asRecord = (value: unknown): Record<string, never> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, never>)
    : {};
