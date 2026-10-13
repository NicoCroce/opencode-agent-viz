import { describe, expect, it } from 'vitest';
import type {
  OpenCodeClient,
  SessionInfo,
  SessionListInput,
  SessionsResponse,
} from '@opencode/client';
import {
  collectAllRootSessions,
  SESSION_MAX_PAGES,
  SESSION_PAGE_SIZE,
} from '../sessionPagination';

/**
 * FR-001/FR-002 · R1 (`contracts/session-roots-contract.md`): `collectAllRootSessions`
 * materializa **todas** las raíces (`parentID: null`) de un directorio paginando
 * por cursor, porque V2 capa `limit` en 200 por request.
 *
 * Las reglas que sostienen el arreglo del listado (sesiones fuera de la ventana):
 * 2 páginas → 2 requests con el cursor encadenado y **sin duplicados**; `order`
 * solo viaja en la primera página (la API rechaza `cursor` + `order`); `truncated`
 * es `true` **solo** al agotar `SESSION_MAX_PAGES` con `cursor.next` presente.
 *
 * El cliente se inyecta por parámetro, así que el spec usa un doble mínimo que
 * registra los argumentos exactos que llegan al SDK (no hay red).
 */

const DIRECTORY = '/Users/dev/proj';

/** Construye una `SessionInfo` con los campos requeridos por el SDK. */
const buildSession = (id: string): SessionInfo => ({
  id,
  projectID: 'proj',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 0, updated: 0 },
  location: { directory: DIRECTORY },
  title: `session ${id}`,
});

/** Respuesta de `session.list`: página de datos + cursor de la siguiente. */
const page = (
  data: SessionInfo[],
  next: string | null = null,
): SessionsResponse => ({ data, cursor: { next } });

/**
 * Doble mínimo de `OpenCodeClient`: cada request se registra en `calls` y la
 * respuesta sale de `pages` en orden. Cuando `pages` se agota, se repite la
 * última (así el spec de truncado no enumera 25 páginas a mano).
 */
const buildClient = (pages: SessionsResponse[]) => {
  const calls: SessionListInput[] = [];
  const list = (input?: SessionListInput): Promise<SessionsResponse> => {
    calls.push(input ?? {});
    const last = pages[pages.length - 1];
    return Promise.resolve(pages[calls.length - 1] ?? last);
  };
  return { client: { session: { list } } as unknown as OpenCodeClient, calls };
};

describe('collectAllRootSessions', () => {
  it('una sola página sin cursor.next: 1 request, args de raíces y truncated false', async () => {
    const { client, calls } = buildClient([
      page([buildSession('ses_1'), buildSession('ses_2')]),
    ]);

    const result = await collectAllRootSessions(client, DIRECTORY);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      directory: DIRECTORY,
      parentID: null,
      limit: SESSION_PAGE_SIZE,
      order: 'desc',
    });
    expect(result.truncated).toBe(false);
    expect(result.sessions.map((session) => session.id)).toEqual([
      'ses_1',
      'ses_2',
    ]);
  });

  it('2 páginas → 2 requests con las raíces concatenadas y sin duplicados', async () => {
    const { client, calls } = buildClient([
      page([buildSession('ses_1'), buildSession('ses_2')], 'cursor-1'),
      page([buildSession('ses_3'), buildSession('ses_4')]),
    ]);

    const result = await collectAllRootSessions(client, DIRECTORY);

    expect(calls).toHaveLength(2);
    const ids = result.sessions.map((session) => session.id);
    expect(ids).toEqual(['ses_1', 'ses_2', 'ses_3', 'ses_4']);
    expect(new Set(ids).size).toBe(ids.length);
    // El cursor de la 1ª página dirige la 2ª (es lo que evita duplicados).
    expect(calls[1]).toMatchObject({
      directory: DIRECTORY,
      parentID: null,
      limit: SESSION_PAGE_SIZE,
      cursor: 'cursor-1',
    });
    expect(result.truncated).toBe(false);
  });

  it('order solo viaja en la primera página: la API rechaza cursor + order', async () => {
    const { client, calls } = buildClient([
      page([buildSession('ses_1')], 'cursor-1'),
      page([buildSession('ses_2')], 'cursor-2'),
      page([buildSession('ses_3')]),
    ]);

    await collectAllRootSessions(client, DIRECTORY);

    expect(calls).toHaveLength(3);
    expect(calls[0].order).toBe('desc');
    expect(calls[0].cursor).toBeUndefined();
    expect(calls[1]).not.toHaveProperty('order');
    expect(calls[2]).not.toHaveProperty('order');
    expect(calls[1].cursor).toBe('cursor-1');
    expect(calls[2].cursor).toBe('cursor-2');
  });

  it('truncated true al agotar SESSION_MAX_PAGES con cursor.next todavía presente', async () => {
    const pages = Array.from({ length: SESSION_MAX_PAGES + 1 }, (_, index) =>
      page([buildSession(`ses_${index + 1}`)], `cursor-${index + 1}`),
    );
    const { client, calls } = buildClient(pages);

    const result = await collectAllRootSessions(client, DIRECTORY);

    expect(calls).toHaveLength(SESSION_MAX_PAGES);
    expect(result.sessions).toHaveLength(SESSION_MAX_PAGES);
    expect(new Set(result.sessions.map((session) => session.id)).size).toBe(
      SESSION_MAX_PAGES,
    );
    expect(result.truncated).toBe(true);
  });
});
