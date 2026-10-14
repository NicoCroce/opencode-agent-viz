import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { V2Event } from '@opencode/client';
import { sameQueryKey } from '@app/Application/Helpers/queryKey';
import { queryKeys } from '@app/Domains/queryKeys';
import { reduceEvent } from '@app/Domains/Graph/lib/eventReducer';
import type { TReducibleEvent } from '@app/Domains/Graph/lib/eventReducer';
import {
  applyReducedEvent,
  applyReducedEvents,
} from '../lib/applyReducedEvent';
import { coalesceQueryUpdates } from '../lib/coalesceQueryUpdates';

/**
 * A3 (`contracts/session-activity-contract.md` §3): `applyReducedEvent` debe
 * aplicar la marca de actividad (`sessions.activity()`) por `setQueryData`
 * —sin peticiones de red— **y** conservar intacto el resultado de `reduceEvent`.
 * La actividad se escribe antes del reducer, de modo que también los deltas
 * (que hoy producen un `set` sobre `chatStream`) refrescan la marca.
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

  it('aplica la actividad y el buffer de chat para los deltas', () => {
    const client = makeClient();
    const updates = reduceEvent(textDelta);
    expect(
      updates?.some(
        (update) =>
          update.kind === 'set' &&
          sameQueryKey(update.queryKey, queryKeys.chatStream.for('ses_1')),
      ),
    ).toBe(true);

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

describe('coalesceQueryUpdates', () => {
  const activityKey = queryKeys.sessions.activity();
  const statusKey = queryKeys.sessions.status();

  it('(a) comprime set+set sobre la misma key en un set con el valor final', () => {
    const push = (value: string) => (prev: unknown) =>
      [...(Array.isArray(prev) ? (prev as unknown[]) : []), value];
    const coalesced = coalesceQueryUpdates([
      { kind: 'set', queryKey: activityKey, updater: push('a') },
      { kind: 'set', queryKey: activityKey, updater: push('b') },
    ]);

    expect(coalesced).toHaveLength(1);
    const [only] = coalesced;
    expect(only.kind).toBe('set');
    if (only.kind !== 'set') throw new Error('se esperaba un set');
    expect(only.updater([])).toEqual(['a', 'b']);
  });

  it('(b) comprime invalidate+invalidate consecutivos en una sola invalidación', () => {
    const coalesced = coalesceQueryUpdates([
      { kind: 'invalidate', queryKey: statusKey },
      { kind: 'invalidate', queryKey: statusKey },
    ]);

    expect(coalesced).toHaveLength(1);
    expect(coalesced[0].kind).toBe('invalidate');
  });

  it('(c) no fusiona set seguido de invalidate sobre la misma key', () => {
    const coalesced = coalesceQueryUpdates([
      { kind: 'set', queryKey: statusKey, updater: (prev) => prev },
      { kind: 'invalidate', queryKey: statusKey },
    ]);

    expect(coalesced.map((update) => update.kind)).toEqual([
      'set',
      'invalidate',
    ]);
  });

  it('no fusiona keys distintas ni corta la run por updates de otra key', () => {
    const push = (value: string) => (prev: unknown) =>
      [...(Array.isArray(prev) ? (prev as unknown[]) : []), value];
    const coalesced = coalesceQueryUpdates([
      { kind: 'set', queryKey: activityKey, updater: push('a') },
      { kind: 'set', queryKey: statusKey, updater: (prev) => prev },
      { kind: 'set', queryKey: activityKey, updater: push('b') },
    ]);

    expect(coalesced).toHaveLength(2);
    const activitySet = coalesced.find(
      (update) =>
        update.kind === 'set' && sameQueryKey(update.queryKey, activityKey),
    );
    if (activitySet?.kind !== 'set') throw new Error('se esperaba el set de activity');
    expect(activitySet.updater([])).toEqual(['a', 'b']);
  });
});

describe('applyReducedEvents — coalescing por flush', () => {
  const statusIdle: V2Event = {
    id: 'evt_status_idle',
    created: 2_000,
    type: 'session.status',
    data: { sessionID: 'ses_1', status: { type: 'idle' } },
  };

  it('(a) N sets sobre la misma key → 1 setQueryData con el valor final', () => {
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');

    applyReducedEvents([statusBusy, statusIdle], client);

    const statusCalls = setSpy.mock.calls.filter(([queryKey]) =>
      sameQueryKey(queryKey, queryKeys.sessions.status()),
    );
    expect(statusCalls).toHaveLength(1);
    expect(client.getQueryData(queryKeys.sessions.status())).toEqual({
      ses_1: { type: 'idle' },
    });
  });

  it('(b) invalidaciones consecutivas del mismo flush → 1 invalidateQueries', () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const secondCreated: V2Event = {
      ...sessionCreated,
      id: 'evt_created_2',
      created: 3_500,
    };

    applyReducedEvents([sessionCreated, secondCreated], client);

    const listInvalidations = invalidateSpy.mock.calls.filter(([filters]) =>
      sameQueryKey(filters?.queryKey ?? [], queryKeys.sessions.all),
    );
    expect(listInvalidations).toHaveLength(1);
  });

  it('(d) N eventos con actividad → estado final idéntico al secuencial', () => {
    const events: V2Event[] = [
      statusBusy,
      textDelta,
      olderTextDelta,
      statusIdle,
      sessionCreated,
    ];

    const coalescedClient = makeClient();
    applyReducedEvents(events, coalescedClient);

    const sequentialClient = makeClient();
    for (const event of events) applyReducedEvent(event, sequentialClient);

    expect(coalescedClient.getQueryData(queryKeys.sessions.activity())).toEqual(
      sequentialClient.getQueryData(queryKeys.sessions.activity()),
    );
    expect(coalescedClient.getQueryData(queryKeys.sessions.status())).toEqual(
      sequentialClient.getQueryData(queryKeys.sessions.status()),
    );
    expect(coalescedClient.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 3_000,
    });
  });

  it('no dispara red y conserva el estado de conexión', () => {
    const client = makeClient();
    const fetchSpy = vi.spyOn(client, 'fetchQuery');

    applyReducedEvents([serverConnected, statusBusy], client);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.connection.state)).toBe('connected');
    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_1: 1_000,
    });
  });
});
