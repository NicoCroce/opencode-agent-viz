import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { V2Event } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import type { TConnectionState } from '@app/Domains/Connection/Connection.entity';
import { useActiveSessionsSeed } from './Hooks/useActiveSessionsSeed';
import { useEventStreamConnection } from './Hooks/useEventStreamConnection';
import { createEventBatcher } from './lib/eventBatcher';
import { applyReducedEvent } from './lib/applyReducedEvent';
import { FLUSH_INTERVAL_MS } from './lib/eventStream.constants';

// Reexport de compatibilidad: el spec importa la función pura desde acá. La
// ruta canónica es `./lib/applyActiveSeed`.
export { applyActiveSeed } from './lib/applyActiveSeed';

interface EventStreamContextValue {
  state: TConnectionState;
}

const EventStreamContext = createContext<EventStreamContextValue>({
  state: 'disconnected',
});

export const useEventStream = (): EventStreamContextValue =>
  useContext(EventStreamContext);

export const EventStreamProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { refreshActive } = useActiveSessionsSeed(queryClient);

  const batcher = useMemo(
    () =>
      createEventBatcher<V2Event>({
        flushIntervalMs: FLUSH_INTERVAL_MS,
        onFlush: (events) => {
          for (const event of events) applyReducedEvent(event, queryClient);
        },
      }),
    [queryClient],
  );

  useEffect(() => () => batcher.cancel(), [batcher]);

  const handleConnected = useCallback(() => {
    void refreshActive(true);
  }, [refreshActive]);

  const handleReconnected = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  }, [queryClient]);

  const state = useEventStreamConnection({
    onEvent: batcher.push,
    onConnected: handleConnected,
    onReconnected: handleReconnected,
  });

  return (
    <EventStreamContext.Provider value={{ state }}>
      {children}
    </EventStreamContext.Provider>
  );
};
