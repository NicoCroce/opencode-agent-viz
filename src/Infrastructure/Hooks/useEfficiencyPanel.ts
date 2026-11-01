import { useCallback, useState } from 'react';

/**
 * Estado de vista del overlay de eficiencia (research R1, overlay §2–§3).
 *
 * El panel es efímero y no persiste nada: `isOpen` y `openedAt` viven aquí para
 * que `WorkspacePage` componga la exclusión mutua con el histórico y para que el
 * informe use un reloj fijo (no tickea). El disparador se guarda como elemento
 * porque el `Dialog.Root` de Radix solo devuelve el foco a su propio `Trigger`,
 * que no es el botón de la cabecera del grafo.
 *
 * - `open(trigger)` guarda el disparador actual y fija `openedAt = clock()`.
 * - `close()` solo cierra; el `onCloseAutoFocus` del diálogo llama después a
 *   `restoreFocus()`.
 * - `restoreFocus()` enfoca el disparador **solo** si sigue en `document`; si se
 *   desmontó, no fuerza un foco inválido ni lanza.
 * - Un cambio de `rootSessionId` cierra y limpia el disparador **durante el
 *   render** (patrón de `useHistoryOverlay`), sin `useEffect` en cascada.
 */

export interface TUseEfficiencyPanelParams {
  /** Sesión raíz del workspace; al cambiar se cierra el panel (FR-006). */
  rootSessionId: string | null;
  /** Reloj inyectable para `openedAt`; por defecto `Date.now` (tests). */
  clock?: () => number;
}

export interface TUseEfficiencyPanelResult {
  isOpen: boolean;
  /** Momento de apertura fijado con `clock()`; `null` con el panel cerrado. */
  openedAt: number | null;
  /** Abre el panel guardando el disparador al que volverá el foco. */
  open: (trigger: HTMLElement | null) => void;
  /** Cierra el panel sin tocar el disparador (lo usa `restoreFocus`). */
  close: () => void;
  /** Devuelve el foco al disparador guardado si sigue montado. */
  restoreFocus: () => void;
}

export const useEfficiencyPanel = ({
  rootSessionId,
  clock = Date.now,
}: TUseEfficiencyPanelParams): TUseEfficiencyPanelResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [trackedRootId, setTrackedRootId] = useState(rootSessionId);

  // Cambio de sesión raíz: se cierra el panel y se olvida el disparador durante
  // el render para no encadenar un render extra con `useEffect`.
  if (trackedRootId !== rootSessionId) {
    setTrackedRootId(rootSessionId);
    setIsOpen(false);
    setOpenedAt(null);
    setTrigger(null);
  }

  const open = useCallback(
    (nextTrigger: HTMLElement | null) => {
      setTrigger(nextTrigger);
      setOpenedAt(clock());
      setIsOpen(true);
    },
    [clock],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const restoreFocus = useCallback(() => {
    if (
      trigger !== null &&
      typeof document !== 'undefined' &&
      document.contains(trigger)
    ) {
      trigger.focus();
    }
  }, [trigger]);

  return { isOpen, openedAt, open, close, restoreFocus };
};
