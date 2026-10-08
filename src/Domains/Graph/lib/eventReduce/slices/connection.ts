import { queryKeys } from '../../../../queryKeys';
import type { TReducibleEvent } from '../eventTypes';
import { set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';

type TConnectionEvent = Extract<TReducibleEvent, { type: 'server.connected' }>;

export const reduceConnection = (_event: TConnectionEvent): TEventUpdate => [
  set(queryKeys.connection.state, () => 'connected'),
];
