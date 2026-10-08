import type { SessionInfo, SessionStatus } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TExecutionSignal } from '../../Graph.entity';

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
