/**
 * Selector del contenedor del panel de chat (`ChatPanel` marca su raíz con
 * `data-testid="chat-panel"`). Se usa para decidir si un `Escape` pertenece al
 * composer (chat-panel-contract §5).
 */
export const CHAT_PANEL_SELECTOR = '[data-testid="chat-panel"]';

/**
 * `true` cuando el foco está dentro del panel de chat: el `Escape` pertenece al
 * composer (que cancela solo su estado inline) y **no** debe propagarse al
 * handler de la página —ni cerrar el fullscreen ni limpiar la selección—
 * (chat-panel-contract §5). El listener global vive en `window`, así que se
 * inspecciona `document.activeElement` en el momento del `keydown`.
 */
export const isFocusWithinChat = (): boolean => {
  const active = document.activeElement;
  return active !== null && active.closest(CHAT_PANEL_SELECTOR) !== null;
};
