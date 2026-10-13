import type { OpenCodeClient, SessionInfo } from '@opencode/client';

/** V2 capa `limit` en 200 por request; paginamos con cursor hasta este tope. */
export const SESSION_PAGE_SIZE = 200;
/** Techo de páginas: 200 × 25 = 5.000 raíces por directorio. */
export const SESSION_MAX_PAGES = 25;

export interface TRootSessionsResult {
  sessions: SessionInfo[];
  truncated: boolean;
}

/**
 * Materializa todas las raíces (`parentID: null`) de un directorio. V2 limita
 * `limit` a 200 por página, así que paginamos con el cursor para que el listado
 * no omita raíces cuando hay más de una página. El cursor ya fija la dirección:
 * la API rechaza `cursor` + `order`, por eso `order: 'desc'` solo viaja en la
 * primera página.
 *
 * `truncated` es `true` cuando se agotan las `SESSION_MAX_PAGES` y todavía queda
 * `cursor.next` (el conjunto no está completo). Sin cursor, el resultado es
 * completo.
 *
 * Recibe el cliente por parámetro (no importa el singleton) para poder testearse
 * en aislamiento.
 */
export const collectAllRootSessions = async (
  client: OpenCodeClient,
  directory?: string,
): Promise<TRootSessionsResult> => {
  const sessions: SessionInfo[] = [];
  let cursor: string | undefined;
  let page = 0;
  for (; page < SESSION_MAX_PAGES; page += 1) {
    const { data, cursor: next } = await client.session.list({
      directory,
      parentID: null,
      limit: SESSION_PAGE_SIZE,
      ...(cursor === undefined ? { order: 'desc' as const } : { cursor }),
    });
    sessions.push(...data);
    if (!next.next) return { sessions, truncated: false };
    cursor = next.next;
  }
  // Se agotaron las páginas con `cursor.next` todavía presente.
  return { sessions, truncated: true };
};
