import { queryKeys } from '../../../../queryKeys';
import { setStatus } from '../cache';
import type { TReducibleEvent } from '../eventTypes';
import { set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';
import { patchExecution } from '../signals';

type TExecutionEvent = Extract<
  TReducibleEvent,
  {
    type:
      | 'session.execution.started'
      | 'session.execution.succeeded'
      | 'session.execution.failed'
      | 'session.execution.interrupted'
      | 'session.retry.scheduled'
      | 'session.compaction.started'
      | 'session.compaction.ended'
      | 'session.compaction.failed';
  }
>;

export const reduceExecution = (
  event: TExecutionEvent,
): TEventUpdate | null => {
  switch (event.type) {
    case 'session.execution.started':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'busy' }),
        ),
        // Una nueva ejecución arranca: el outcome/anomalía de la corrida previa
        // ya no describe lo que pasa ahora. Sin este reset, `toNodeStatus`
        // devolvería el `succeeded` viejo (el outcome gana sobre `busy`) mientras
        // el agente vuelve a correr.
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            outcome: null,
            interruptReason: null,
            retry: null,
          }),
        ),
      ];

    case 'session.execution.succeeded':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { outcome: 'succeeded' }),
        ),
      ];

    case 'session.execution.failed':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { outcome: 'failed' }),
        ),
      ];

    case 'session.execution.interrupted':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            outcome: 'interrupted',
            interruptReason: event.data.reason,
          }),
        ),
      ];

    /* --- retry / compactacion (senales de ejecucion, FR-018/FR-019) --- */
    case 'session.retry.scheduled':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            retry: { attempt: event.data.attempt, next: event.data.at },
          }),
        ),
      ];

    case 'session.compaction.started':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { compaction: 'running' }),
        ),
      ];

    case 'session.compaction.ended':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            compaction: 'completed',
          }),
        ),
      ];

    case 'session.compaction.failed':
      return [
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, { compaction: 'failed' }),
        ),
      ];

    default:
      return null;
  }
};
