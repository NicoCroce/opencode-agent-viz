import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '@opencode/client';
import { opencodeClient } from '../client';
import { sessionReadService } from '../session.service';

/** V2 capa `limit` en 200 por request (contrato `session-roots`, §1). */
const PAGE_SIZE = 200;
/** Techo de páginas: 200 × 25 = 5.000 raíces por directorio (contrato §1). */
const MAX_PAGES = 25;

/**
 * `SessionInfo` mínima con `parentID` controlable. Las raíces del listado son
 * las que el server devuelve con `parentID` ausente.
 */
const buildSession = (
  id: string,
  overrides: Partial<SessionInfo> = {},
): SessionInfo => ({
  id,
  parentID: undefined,
  projectID: 'proj_1',
  agent: 'build',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 1 },
  location: { directory: '/repo/a' },
  title: `session ${id}`,
  ...overrides,
});

/**
 * Contrato `session-roots` (R1): `listRootSessions` filtra raíces en el server
 * (`parentID: null`) y pagina por cursor. Se mockea la frontera del cliente
 * (`opencodeClient.session.list`) y se assertan los argumentos exactos que
 * llegan al SDK; canon: `opencodeClient.spec.ts`.
 */
describe('sessionReadService.listRootSessions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pide las raíces del directorio con parentID: null y order desc', async () => {
    const list = vi.spyOn(opencodeClient.session, 'list').mockResolvedValueOnce({
      data: [buildSession('ses_root_1'), buildSession('ses_root_2')],
      cursor: { next: null },
    });

    const result = await sessionReadService.listRootSessions('/repo/a');

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({
      directory: '/repo/a',
      parentID: null,
      limit: PAGE_SIZE,
      order: 'desc',
    });
    expect(list.mock.calls[0]?.[0]).toHaveProperty('parentID', null);
    expect(result.sessions.map((session) => session.id)).toEqual([
      'ses_root_1',
      'ses_root_2',
    ]);
    expect(result.truncated).toBe(false);
  });

  it('omite el directory sin perder el filtro parentID: null', async () => {
    const list = vi.spyOn(opencodeClient.session, 'list').mockResolvedValueOnce({
      data: [],
      cursor: {},
    });

    await sessionReadService.listRootSessions();

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ parentID: null, limit: PAGE_SIZE }),
    );
  });

  it('pagina con cursor: 2 páginas → 2 requests, sin order en la 2ª y sin duplicados', async () => {
    const list = vi
      .spyOn(opencodeClient.session, 'list')
      .mockResolvedValueOnce({
        data: [buildSession('ses_root_1'), buildSession('ses_root_2')],
        cursor: { next: 'cur_2' },
      })
      .mockResolvedValueOnce({
        data: [buildSession('ses_root_3')],
        cursor: { next: null },
      });

    const result = await sessionReadService.listRootSessions('/repo/a');

    expect(list).toHaveBeenCalledTimes(2);
    // El cursor ya fija la dirección: la 2ª página nunca reenvía `order`.
    expect(list).toHaveBeenNthCalledWith(2, {
      directory: '/repo/a',
      parentID: null,
      limit: PAGE_SIZE,
      cursor: 'cur_2',
    });
    expect(list.mock.calls[1]?.[0]).not.toHaveProperty('order');
    // Concatenación en orden de página; el cursor avanza ⇒ sin duplicados.
    expect(result.sessions.map((session) => session.id)).toEqual([
      'ses_root_1',
      'ses_root_2',
      'ses_root_3',
    ]);
    expect(new Set(result.sessions.map((s) => s.id)).size).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('marca truncated cuando agota SESSION_MAX_PAGES con cursor pendiente', async () => {
    let page = 0;
    const list = vi
      .spyOn(opencodeClient.session, 'list')
      .mockImplementation(() => {
        page += 1;
        return Promise.resolve({
          data: [buildSession(`ses_root_${page}`)],
          cursor: { next: `cur_${page}` },
        });
      });

    const result = await sessionReadService.listRootSessions('/repo/a');

    expect(list).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.sessions).toHaveLength(MAX_PAGES);
    expect(result.truncated).toBe(true);
  });

  it('propaga el rechazo del SDK', async () => {
    const error = new Error('list boom');
    vi.spyOn(opencodeClient.session, 'list').mockRejectedValue(error);

    await expect(
      sessionReadService.listRootSessions('/repo/a'),
    ).rejects.toBe(error);
  });
});
