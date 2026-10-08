import { queryKeys } from '../../../../queryKeys';
import type { TReducibleEvent } from '../eventTypes';
import { removePermission, upsertPermission } from '../permissions';
import { set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';

type TPermissionsEvent = Extract<
  TReducibleEvent,
  { type: 'permission.asked' | 'permission.replied' }
>;

export const reducePermissions = (
  event: TPermissionsEvent,
): TEventUpdate | null => {
  switch (event.type) {
    case 'permission.asked':
      return [
        set(queryKeys.permissions.list(), (prev) =>
          upsertPermission(prev, event.data),
        ),
      ];

    case 'permission.replied':
      return [
        set(queryKeys.permissions.list(), (prev) =>
          removePermission(prev, event.data.requestID),
        ),
      ];

    default:
      return null;
  }
};
