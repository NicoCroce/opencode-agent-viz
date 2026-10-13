import { useCallback } from 'react';
import { useEscapeKey } from '@app/Application/Hooks';
import { isFocusWithinChat } from '../lib/isFocusWithinChat';

/**
 * Entradas del manejo de `Escape` del workspace: el fullscreen efímero del
 * panel de detalle (US6/FR-015) y la selección de nodo del grafo (U2/U6).
 */
export interface TWorkspaceEscapeParams {
  isFullscreen: boolean;
  closeFullscreen: () => void;
  clearSelection: () => void;
  selectedNodeId: string | null;
}

/**
 * Precedencia de `Escape` (T012/FR-009, chat-panel-contract §5):
 *
 * 1. Foco **dentro del panel de chat** ⇒ el `Escape` pertenece al composer (que
 *    cancela solo su estado inline) y **no** se propaga: ni cierra el fullscreen
 *    ni limpia la selección.
 * 2. Fuera del composer, con panel en pantalla completa ⇒ `closeFullscreen`.
 * 3. Si no, `clearSelection`.
 *
 * El listener es global (`window`) y se registra **solo** cuando hay fullscreen
 * o selección (`useEscapeKey(handler, isFullscreen || selectedNodeId !== null)`);
 * el predicado de foco es una única fuente (`isFocusWithinChat`) que inspecciona
 * `document.activeElement` en el momento del `keydown`.
 */
export const useWorkspaceEscape = ({
  isFullscreen,
  closeFullscreen,
  clearSelection,
  selectedNodeId,
}: TWorkspaceEscapeParams): void => {
  const handleEscape = useCallback(() => {
    if (isFocusWithinChat()) return;
    if (isFullscreen) {
      closeFullscreen();
      return;
    }
    clearSelection();
  }, [isFullscreen, closeFullscreen, clearSelection]);

  useEscapeKey(handleEscape, isFullscreen || selectedNodeId !== null);
};
