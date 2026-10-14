import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { SessionInfo, V2Event } from '@opencode/client';
import { sameQueryKey } from '@app/Application/Helpers/queryKey';
import { queryKeys } from '@app/Domains/queryKeys';
import { reduceEvent } from '@app/Domains/Graph/lib/eventReducer';
import type { TQueryUpdate } from '@app/Domains/Graph/lib/eventReducer';
import { applyReducedEvents } from '../applyReducedEvent';
import { coalesceQueryUpdates } from '../coalesceQueryUpdates';

/**
 * Reglas de compresión del flush SSE (`coalesceQueryUpdates`, consumido por
 * `applyReducedEvents` en `EventStreamProvider.onFlush`).
 *
 * Este spec cubre las invariantes que el spec de `applyReducedEvent` no fija:
 * (c) el caso mixto `set`→`invalidate` sobre la **misma** key conserva ambos y
 * su orden, con efecto verificable en la caché; (d) keys distintas —incluidas
 * las que comparten prefijo— no se fusionan; (e) el estado final de la caché
 * (datos **e** `isInvalidated`) tras un flush coalescido es idéntico al de
 * aplicar los eventos en orden (cadena real del fixture `run.v2.ndjson`,
 * dispatch por producción en ambos lados), con menos llamadas al `queryClient`.
 * Cubre además el caso de la reparación: `invalidate(['sessions'])` intercalado
 * entre dos `set` de `['sessions','activity']` no puede dejar la key invalidada,
 * porque `invalidateQueries` casa por prefijo.
 *
 * Casos negativos exigidos por el contrato: flush vacío (no dispara nada y no
 * crea cachés), y flush sin eventos de sesión / sólo con invalidaciones (la
 * caché de actividad y la lista invalidada siguen **inexistentes**: una
 * invalidación no fabrica datos).
 */

const makeClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Corrida real de `develop` en `ses_root`, en su forma V2 (16 eventos). */
const RUN_V2_FIXTURE = join(
  process.cwd(),
  'src/Domains/Graph/lib/__fixtures__/run.v2.ndjson',
);

const runV2Events = (): V2Event[] =>
  readFileSync(RUN_V2_FIXTURE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as V2Event);

const fixtureEvent = (id: string): V2Event => {
  const event = runV2Events().find((candidate) => candidate.id === id);
  if (!event) throw new Error(`el fixture run.v2.ndjson no tiene ${id}`);
  return event;
};

/** `SessionInfo` mínimo de la corrida re-capturada en `run.v2.ndjson`. */
const RUN_V2_SESSION: SessionInfo = {
  id: 'ses_root',
  projectID: 'proj',
  agent: 'develop',
  cost: 0.0123,
  tokens: {
    input: 1200,
    output: 300,
    reasoning: 120,
    cache: { read: 400, write: 50 },
  },
  time: { created: 1000, updated: 1200, idle: 1200 },
  title: 'develop',
  location: { directory: '/repo' },
};

const setUpdate = (
  queryKey: readonly unknown[],
  updater: (prev: unknown) => unknown,
): TQueryUpdate => ({ kind: 'set', queryKey, updater });

const invalidateUpdate = (queryKey: readonly unknown[]): TQueryUpdate => ({
  kind: 'invalidate',
  queryKey,
});

/** Updater de prueba con efecto observable: acumula el valor en un array. */
const push =
  (value: string) =>
  (prev: unknown): string[] => [
    ...(Array.isArray(prev) ? (prev as string[]) : []),
    value,
  ];

/** Proyección comparable del resultado: clase + key, en orden. */
const kindsAndKeys = (
  updates: readonly TQueryUpdate[],
): Array<{ kind: string; key: string }> =>
  updates.map((update) => ({
    kind: update.kind,
    key: JSON.stringify(update.queryKey),
  }));

/** Estado **completo** de toda la caché (datos + `isInvalidated`), comparable. */
const cacheSnapshot = (
  client: QueryClient,
): Array<{ key: string; data: unknown; isInvalidated: boolean }> =>
  client
    .getQueryCache()
    .getAll()
    .map((query) => ({
      key: JSON.stringify(query.queryKey),
      data: query.state.data,
      isInvalidated: query.state.isInvalidated,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

/** Aplica updates en orden al `queryClient`, como hace `applyReducedEvents`. */
const dispatch = (
  updates: readonly TQueryUpdate[],
  client: QueryClient,
): void => {
  for (const update of updates) {
    if (update.kind === 'invalidate') {
      void client.invalidateQueries({ queryKey: update.queryKey });
    } else {
      client.setQueryData(update.queryKey, update.updater);
    }
  }
};

describe('coalesceQueryUpdates — caso mixto `set`/`invalidate` (c)', () => {
  it('(c) `set` → `invalidate` sobre la misma key colapsa sólo los `invalidate` siguientes', () => {
    const statusKey = queryKeys.sessions.status();
    const coalesced = coalesceQueryUpdates([
      setUpdate(statusKey, push('busy')),
      invalidateUpdate(statusKey),
      invalidateUpdate(statusKey),
    ]);

    expect(coalesced).toHaveLength(2);
    const [first, second] = coalesced;
    expect(first.kind).toBe('set');
    expect(sameQueryKey(first.queryKey, statusKey)).toBe(true);
    expect(second.kind).toBe('invalidate');
    expect(sameQueryKey(second.queryKey, statusKey)).toBe(true);
  });

  it('(c) `invalidate` → `set` conserva ambos, en ese orden, y fusiona el `set` siguiente', () => {
    const activityKey = queryKeys.sessions.activity();
    const coalesced = coalesceQueryUpdates([
      invalidateUpdate(activityKey),
      setUpdate(activityKey, push('a')),
      setUpdate(activityKey, push('b')),
    ]);

    expect(coalesced).toHaveLength(2);
    expect(coalesced[0].kind).toBe('invalidate');
    expect(coalesced[1].kind).toBe('set');
    if (coalesced[1].kind !== 'set') throw new Error('se esperaba un set');
    // La composición respeta el orden de aplicación: `a` antes que `b`.
    expect(coalesced[1].updater([])).toEqual(['a', 'b']);
  });

  it('(c) cadena real `session.deleted` (set) → `session.created` (invalidate): el set llega primero', () => {
    const sessionDeleted: V2Event = {
      id: 'evt_deleted',
      created: 1_300,
      type: 'session.deleted',
      durable: { aggregateID: 'ses_root', seq: 15, version: 2 },
      data: { sessionID: 'ses_root' },
    };
    const sessionCreated = fixtureEvent('evt_session_created');
    const other: SessionInfo = { ...RUN_V2_SESSION, id: 'ses_other' };

    const client = makeClient();
    client.setQueryData(queryKeys.sessions.all, [RUN_V2_SESSION, other]);
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    applyReducedEvents([sessionDeleted, sessionCreated], client);

    // El `set` se aplicó (quedó sólo `ses_other`) y después se invalidó la lista.
    expect(client.getQueryData(queryKeys.sessions.all)).toEqual([other]);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.all,
    });
  });

  it('(c) el orden inverso (`invalidate` → `set`) también se preserva en la caché', () => {
    const sessionCreated = fixtureEvent('evt_session_created');
    const sessionDeleted: V2Event = {
      id: 'evt_deleted_later',
      created: 1_400,
      type: 'session.deleted',
      durable: { aggregateID: 'ses_root', seq: 16, version: 2 },
      data: { sessionID: 'ses_root' },
    };
    const other: SessionInfo = { ...RUN_V2_SESSION, id: 'ses_other' };

    const client = makeClient();
    client.setQueryData(queryKeys.sessions.all, [RUN_V2_SESSION, other]);
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    applyReducedEvents([sessionCreated, sessionDeleted], client);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.sessions.all)).toEqual([other]);
  });
});

describe('coalesceQueryUpdates — keys distintas (d)', () => {
  it('(d) no fusiona keys distintas, ni las que comparten prefijo', () => {
    // `sessions.all` (["sessions"]) es prefijo de `status`/`activity`: la
    // invalidación por prefijo de TanStack los alcanza, pero el coalescing debe
    // seguir siendo por igualdad exacta de key.
    const keys = [
      queryKeys.sessions.all,
      queryKeys.sessions.status(),
      queryKeys.sessions.activity(),
      queryKeys.chatStream.for('ses_root'),
    ];
    const coalesced = coalesceQueryUpdates(
      keys.map((key, index) => setUpdate(key, push(`v${index}`))),
    );

    expect(kindsAndKeys(coalesced)).toEqual([
      { kind: 'set', key: '["sessions"]' },
      { kind: 'set', key: '["sessions","status"]' },
      { kind: 'set', key: '["sessions","activity"]' },
      { kind: 'set', key: '["chatStream","ses_root"]' },
    ]);
  });

  it('(d) un `set` y un `invalidate` sobre keys distintas conviven sin fusionarse', () => {
    const statusKey = queryKeys.sessions.status();
    const listKey = queryKeys.sessions.roots('/repo');
    const coalesced = coalesceQueryUpdates([
      setUpdate(statusKey, push('idle')),
      invalidateUpdate(listKey),
    ]);

    expect(kindsAndKeys(coalesced)).toEqual([
      { kind: 'set', key: '["sessions","status"]' },
      { kind: 'invalidate', key: '["sessions","/repo","roots"]' },
    ]);
  });
});

describe('coalesceQueryUpdates — estado final equivalente (e)', () => {
  it('(e) un flush completo deja la caché igual que aplicar los eventos en orden, con menos `setQueryData`', () => {
    const events = runV2Events();

    const coalescedClient = makeClient();
    const coalescedSets = vi.spyOn(coalescedClient, 'setQueryData');
    applyReducedEvents(events, coalescedClient);

    // Mismo dispatch de producción, pero sin coalescer: cada evento en su flush.
    const orderedClient = makeClient();
    const orderedSets = vi.spyOn(orderedClient, 'setQueryData');
    for (const event of events) applyReducedEvents([event], orderedClient);

    expect(cacheSnapshot(coalescedClient)).toEqual(cacheSnapshot(orderedClient));
    expect(coalescedSets.mock.calls.length).toBeLessThan(
      orderedSets.mock.calls.length,
    );
    // La marca de actividad sale del mismo reducer: `max(created)` de la corrida.
    expect(coalescedClient.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_root: 1_200,
    });
    expect(coalescedClient.getQueryData(queryKeys.sessions.status())).toEqual({
      ses_root: { type: 'idle' },
    });
  });

  it('(e) los 16 eventos del flush escriben la actividad en un único `setQueryData`', () => {
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');
    const activityKey = queryKeys.sessions.activity();

    applyReducedEvents(runV2Events(), client);

    const activityCalls = setSpy.mock.calls.filter(([queryKey]) =>
      sameQueryKey(queryKey, activityKey),
    );
    expect(activityCalls).toHaveLength(1);
  });

  it('(e) coalescer es idempotente: re-coalescer no cambia clases, keys ni orden', () => {
    const updates = runV2Events().flatMap((event) => reduceEvent(event) ?? []);
    const once = coalesceQueryUpdates(updates);
    const twice = coalesceQueryUpdates(once);

    expect(kindsAndKeys(twice)).toEqual(kindsAndKeys(once));
  });

  it('(e) un `invalidate` de prefijo intercalado no invalida la key del `set` final', () => {
    // `invalidate(['sessions'])` alcanza a `['sessions','activity']` por prefijo:
    // el `set` final debe quedar DESPUÉS de la invalidación en el flush coalescido.
    const activityKey = queryKeys.sessions.activity();
    const updates: TQueryUpdate[] = [
      setUpdate(activityKey, push('a')),
      invalidateUpdate(queryKeys.sessions.all),
      setUpdate(activityKey, push('b')),
    ];

    const coalesced = coalesceQueryUpdates(updates);
    expect(kindsAndKeys(coalesced)).toEqual([
      { kind: 'invalidate', key: '["sessions"]' },
      { kind: 'set', key: '["sessions","activity"]' },
    ]);

    // La key debe existir para que la invalidación de prefijo deje rastro observable.
    const coalescedClient = makeClient();
    const orderedClient = makeClient();
    coalescedClient.setQueryData(activityKey, {});
    orderedClient.setQueryData(activityKey, {});

    dispatch(coalesced, coalescedClient);
    dispatch(updates, orderedClient);

    expect(cacheSnapshot(coalescedClient)).toEqual(cacheSnapshot(orderedClient));
    expect(coalescedClient.getQueryState(activityKey)?.isInvalidated).toBe(false);
  });
});

describe('coalesceQueryUpdates — casos negativos y vacíos', () => {
  it('no inventa updates con una entrada vacía', () => {
    expect(coalesceQueryUpdates([])).toEqual([]);
  });

  it('un flush vacío no toca la caché ni dispara llamadas', () => {
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    expect(() => applyReducedEvents([], client)).not.toThrow();

    expect(setSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(cacheSnapshot(client)).toEqual([]);
  });

  it('un flush sin eventos de sesión no crea la caché de actividad', () => {
    const connected = fixtureEvent('evt_connected');
    const client = makeClient();
    const setSpy = vi.spyOn(client, 'setQueryData');

    applyReducedEvents([connected, connected, connected], client);

    expect(client.getQueryData(queryKeys.sessions.activity())).toBeUndefined();
    expect(
      setSpy.mock.calls.filter(([queryKey]) =>
        sameQueryKey(queryKey, queryKeys.connection.state),
      ),
    ).toHaveLength(1);
    expect(client.getQueryData(queryKeys.connection.state)).toBe('connected');
  });

  it('sólo invalidaciones: no fabrica datos para las keys inexistentes', () => {
    const sessionCreated = fixtureEvent('evt_session_created');
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    applyReducedEvents([sessionCreated], client);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.all,
    });
    // No había lista cacheada y la invalidación no la crea (sigue inexistente).
    expect(
      client.getQueryData(queryKeys.sessions.all),
    ).toBeUndefined();
    // La actividad sí escribe, sembrando el mapa vacío para `prev` inexistente.
    expect(client.getQueryData(queryKeys.sessions.activity())).toEqual({
      ses_root: 1_000,
    });
  });
});
