import { queryKeys } from '../../../../queryKeys';
import { removeSession, setStatus } from '../cache';
import type { TReducibleEvent } from '../eventTypes';
import { invalidateSessionLists, set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';
import { patchExecution } from '../signals';

type TSessionLifecycleEvent = Extract<
  TReducibleEvent,
  {
    type:
      | 'session.created'
      | 'session.renamed'
      | 'session.metadata.updated'
      | 'session.moved'
      | 'session.usage.updated'
      | 'session.forked'
      | 'session.agent.selected'
      | 'session.model.selected'
      | 'session.deleted'
      | 'session.status'
      | 'session.idle';
  }
>;

export const reduceSessionLifecycle = (
  event: TSessionLifecycleEvent,
): TEventUpdate | null => {
  switch (event.type) {
    /* --- ciclo de vida: V2 solo emite deltas, no el SessionInfo completo --- */
    case 'session.created':
    case 'session.renamed':
    case 'session.metadata.updated':
    case 'session.moved':
    case 'session.usage.updated':
    case 'session.forked':
    case 'session.agent.selected':
    case 'session.model.selected':
      return [invalidateSessionLists()];

    case 'session.deleted':
      return [
        set(queryKeys.sessions.all, (prev) =>
          removeSession(prev, event.data.sessionID),
        ),
      ];

    /* --- estado --- */
    case 'session.status': {
      const { sessionID, status } = event.data;
      const updates: TEventUpdate = [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, sessionID, status),
        ),
      ];
      // `status.type === 'retry'` aporta `attempt`/`next` a las senales (R5).
      if (status.type === 'retry') {
        updates.push(
          set(queryKeys.sessions.execution(sessionID), (prev) =>
            patchExecution(prev, sessionID, {
              retry: { attempt: status.attempt, next: status.next },
            }),
          ),
        );
      }
      return updates;
    }

    case 'session.idle':
      return [
        set(queryKeys.sessions.status(), (prev) =>
          setStatus(prev, event.data.sessionID, { type: 'idle' }),
        ),
        // El evento SSE `session.idle` no aporta `outcome`; solo limpia el
        // estado activo (retry/compaction) al quedar la sesion ociosa (R5).
        set(queryKeys.sessions.execution(event.data.sessionID), (prev) =>
          patchExecution(prev, event.data.sessionID, {
            retry: null,
            compaction: null,
          }),
        ),
      ];

    default:
      return null;
  }
};
