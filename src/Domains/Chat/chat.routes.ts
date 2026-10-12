/**
 * Constantes de rutas del chat (destino de primer nivel).
 *
 * El chat es un panel/pestaña, no una ruta propia (plan §Notas 3): se alcanza
 * dentro de la ruta de detalle de sesión, como pestaña `Detalle | Chat` en
 * desktop y como tab de primer nivel del workspace en móvil (FR-013). Estas
 * constantes evitan magic strings en `WorkspacePage`/`WorkspaceMobileTabs` y en
 * la navegación a la request origen (FR-010).
 */

/** Identificador de la pestaña/tab del chat (desktop y móvil). */
export const CHAT_TAB = 'chat';

/** Ruta del workspace que hospeda el panel de chat (detalle de sesión). */
export const CHAT_ROUTE = '/sessions/:id';

/** Destino del panel de chat para una sesión concreta (FR-010). */
export const chatPath = (id: string): string => `/sessions/${id}`;
