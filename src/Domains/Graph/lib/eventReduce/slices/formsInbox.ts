import { queryKeys } from '../../../../queryKeys';
import type { TReducibleEvent } from '../eventTypes';
import { invalidate } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';

type TFormsInboxEvent = Extract<
  TReducibleEvent,
  {
    type:
      | 'session.inbox.delivered'
      | 'session.inbox.enqueued'
      | 'session.inbox.cancelled'
      | 'session.inbox.delivery.changed'
      | 'form.created'
      | 'form.replied'
      | 'form.cancelled';
  }
>;

export const reduceFormsInbox = (
  event: TFormsInboxEvent,
): TEventUpdate | null => {
  switch (event.type) {
    /* --- inbox / forms: invalidar la query de la sesion para refetch --- */
    case 'session.inbox.delivered':
    case 'session.inbox.enqueued':
    case 'session.inbox.cancelled':
    case 'session.inbox.delivery.changed':
      return [invalidate(queryKeys.sessions.inbox(event.data.sessionID))];

    case 'form.created':
      return [
        invalidate(queryKeys.sessions.forms(event.data.form.sessionID)),
      ];

    case 'form.replied':
    case 'form.cancelled':
      return [invalidate(queryKeys.sessions.forms(event.data.sessionID))];

    default:
      return null;
  }
};
