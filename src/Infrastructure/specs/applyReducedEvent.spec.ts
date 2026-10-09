import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { V2Event } from '@opencode/client';
import { sameQueryKey } from '@app/Application/Helpers/queryKey';
import { queryKeys } from '@app/Domains/queryKeys';
import { reduceEvent } from '@app/Domains/Graph/lib/eventReducer';
import type { TReducibleEvent } from '@app/Domains/Graph/lib/eventReducer';
import { applyReducedEvent } from '../lib/applyReducedEvent';

/**
 * A3 (`contracts/session-activity-contract.md` §3): `applyReducedEvent` debe
 * aplicar la marca de actividad (`sessions.activity()`) por `setQueryData`
 * —sin peticiones de red— **y** conservar intacto el resultado de `reduceEvent`.
 * La actividad se escribe antes del reducer, de modo que también los eventos
 * que `reduceEvent` ignora (deltas) refrescan la marca.
 */

const makeClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Espeja el dispatch histórico de `reduceEvent` (línea base) para comprobar que
 * `applyReducedEvent` no altera su resultado al añadir la actividad.
 */
const applyReduceEventOnly = (
  event: TReducibleEvent,
  queryClient: QueryClient,
): void => {
  const updates = reduceEvent(event);
  if (!updates) return;
  for (const update of updates) {
    if (update.kind === 'invalidate') {
      void queryClient.invalidateQueries({ queryKey: update.queryKey });
    } else {
      queryClient.setQueryData(update.queryKey, update.updater);
    }
  }
};

const statusBusy: V2Event = {
  id: 'evt_status_busy',
  created: 1_000,
  type: 'session.status',
  data: { sessionID: 'ses_1', status: { type: 'busy' } },
};

const textDelta: V2Event = {
  id: 'evt_text_delta',
  created: 2_000,
  type: 'session.text.delta',
  data: {
    sessionID: 'ses_1',
    assistantMessageID: 'msg_1',
    ordinal: 0,
    delta: 'ho',
  },
};

/** Mismo delta pero con una marca temporal anterior (para probar monotonía). */
const olderTextDelta: V2Event = { ...textDelta, created: 500 };

const serverConnected: V2Event = {
  id: 'evt_connected',
  type: 'server.connected',
  data: {},
};

const sessionCreated: V2Event = {
  id: 'evt_created',
  created: 3_000,
  type: 'session.created',
  durable: { aggregateID: 'ses_1', seq: 1, version: 1 },
  data: {
    sessionID: 'ses_1',
    projectID: 'proj',
    location: { directory: '/repo' },
    slug: 'crisp-rocket',
    version: '1',
  },
};

describe('applyReducedEvent — marca de actividad (A3)', () => {
  it('aplica la actividad por setQueryData para un evento con sesión', () => {
    const client = makeClient();

    applyReducedEvent(statusBusy, client);

    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 1_000,
    });
  });

  it('mantiene intacto el resultado de reduceEvent', () => {
    const baseline = makeClient();
    applyReduceEventOnly(statusBusy, baseline);

    const client = makeClient();
    applyReducedEvent(statusBusy, client);

    expect(client.getQueryData(queryKeys.sessions.status())).toEqual(
      baseline.getQueryData(queryKeys.sessions.status()),
    );
    expect(client.getQueryData(queryKeys.sessions.status())).toEqual({
      ses_1: { type: 'busy' },
    });
  });

  it('aplica la actividad aunque reduceEvent ignore el evento (deltas)', () => {
    const client = makeClient();
    expect(reduceEvent(textDelta)).toBeNull();

    applyReducedEvent(textDelta, client);

    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 2_000,
    });
  });

  it('es monótono: la marca no retrocede con un evento anterior', () => {
    const client = makeClient();
    applyReducedEvent(statusBusy, client);
    applyReducedEvent(textDelta, client);
    applyReducedEvent(olderTextDelta, client);

    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 2_000,
    });
  });

  it('no aplica actividad para eventos sin sesión (server.connected)', () => {
    const client = makeClient();

    applyReducedEvent(serverConnected, client);

    expect(client.getQueryData(queryKeys.sessions.activity())).toBeUndefined();
    expect(client.getQueryData(queryKeys.connection.state)).toBe('connected');
  });

  it('conserva la invalidación de reduceEvent y agrega la actividad', () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    applyReducedEvent(sessionCreated, client);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.all,
    });
    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 3_000,
    });
  });

  it('no dispara peticiones de red: escribe la actividad por setQueryData', () => {
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');
    const fetchSpy = vi.spyOn(client, 'fetchQuery');
    const activityKey = queryKeys.sessions.activity();

    applyReducedEvent(statusBusy, client);

    expect(
      setSpy.mock.calls.some(([queryKey]) =>
        sameQueryKey(queryKey, activityKey),
      ),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
