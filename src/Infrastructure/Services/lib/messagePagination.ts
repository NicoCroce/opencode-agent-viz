import type { OpenCodeClient, SessionMessageInfo } from '@opencode/client';

/** V2 capa `limit` en 200 por request; paginamos con cursor hasta este tope. */
export const MESSAGE_PAGE_SIZE = 200;
export const MESSAGE_MAX_PAGES = 25;

/**
 * Materializa todas las páginas de mensajes de una sesión. V2 limita `limit` a
 * 200 por página (pedir más da error de validación), así que paginamos con el
 * cursor para no truncar métricas de sesiones largas. El cursor ya fija la
 * dirección: la API rechaza `cursor` + `order`, por eso `order` solo viaja en la
 * primera página.
 *
 * Recibe el cliente por parámetro (no importa el singleton) para poder testearse
 * en aislamiento.
 */
export const collectAllMessages = async (
  client: OpenCodeClient,
  id: string,
): Promise<SessionMessageInfo[]> => {
  const messages: SessionMessageInfo[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MESSAGE_MAX_PAGES; page += 1) {
    const { data, cursor: next } = await client.message.list({
      sessionID: id,
      limit: MESSAGE_PAGE_SIZE,
      ...(cursor === undefined ? { order: 'asc' as const } : { cursor }),
    });
    messages.push(...data);
    if (!next.next) break;
    cursor = next.next;
  }
  return messages;
};
