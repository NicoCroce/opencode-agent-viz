import { useEventStream } from '@app/Infrastructure/EventStreamProvider';
import type { TConnectionState } from '../Connection.entity';

export const useConnectionStatus = (): { state: TConnectionState } => {
  const { state } = useEventStream();
  return { state };
};
