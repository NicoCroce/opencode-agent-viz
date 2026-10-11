import { useCallback, useState } from 'react';
import type { TChatDraft } from '../Chat.entity';

/**
 * Borrador del compositor persistido por sesión (FR-015; data-model §2.6).
 *
 * El **texto** es la única preferencia de UI que el chat guarda en
 * `localStorage` (`chat.draft.<sessionId>`): se rehidrata al montar y sobrevive
 * al cambio de pestaña/vista y a la rotación del dispositivo (SC-006). El
 * panel móvil se desmonta al cambiar de tab, así que persistir el texto es la
 * forma robusta de conservarlo sin mover todo el estado a un store global.
 *
 * `isSubmitting` y `queued` son transitorios y **no** se persisten: son estado
 * derivado de la mutation de envío (`isPending`) y de si el prompt fue a la cola
 * (`delivery: 'queue'`). El controlador los inyecta para componer el view-model
 * `TChatDraft` que consume el composer; este hook solo los re-expone.
 *
 * Toda la lógica vive en el hook (AGENTS §4); el componente es presentación pura.
 */

/** Prefijo de la clave de `localStorage` del borrador por sesión. */
export const CHAT_DRAFT_KEY_PREFIX = 'chat.draft.';

/** Clave de `localStorage` del borrador de una sesión concreta (FR-015). */
export const chatDraftKey = (sessionId: string): string =>
  `${CHAT_DRAFT_KEY_PREFIX}${sessionId}`;

/** Lee el borrador guardado; `''` si no hay valor (rehidratación al montar). */
const readStoredText = (sessionId: string): string => {
  if (typeof window === 'undefined') return '';

  return window.localStorage.getItem(chatDraftKey(sessionId)) ?? '';
};

/**
 * Persiste el borrador. Un texto vacío **elimina** la clave en lugar de
 * guardar `''`, para no dejar entradas obsoletas por sesión.
 */
const writeStoredText = (sessionId: string, text: string): void => {
  if (typeof window === 'undefined') return;

  const key = chatDraftKey(sessionId);
  if (text === '') {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, text);
};

/** Estado transitorio de envío que el controlador aporta al view-model. */
export interface TUseChatDraftOptions {
  /** `true` mientras la mutation de envío está en curso (`isPending`). */
  isSubmitting?: boolean;
  /** `true` cuando el último envío fue a la cola (`delivery: 'queue'`). */
  queued?: boolean;
}

/** View-model del borrador (`TChatDraft`) más los controles del texto. */
export interface TUseChatDraftResult extends TChatDraft {
  /** Reemplaza el texto y lo persiste (vacío → elimina la clave). */
  setText: (text: string) => void;
  /** Vacía el texto y elimina el borrador persistido. */
  clear: () => void;
}

/**
 * `useChatDraft(sessionId)` — borrador persistido del compositor.
 *
 * - `text` se rehidrata desde `localStorage` al montar y se vuelve a leer si
 *   cambia la sesión (el panel se reusa entre sesiones).
 * - `setText` actualiza el estado y persiste; `clear` vacía y limpia la clave.
 * - `isSubmitting`/`queued` se re-expone tal cual desde las opciones.
 */
export const useChatDraft = (
  sessionId: string,
  { isSubmitting = false, queued = false }: TUseChatDraftOptions = {},
): TUseChatDraftResult => {
  const [text, setTextState] = useState<string>(() => readStoredText(sessionId));
  const [hydratedSessionId, setHydratedSessionId] = useState<string>(sessionId);

  // Reajuste en render al cambiar de sesión (patrón de React para derivar estado
  // de una prop): rehidrata el borrador de la nueva sesión sin un efecto que
  // dispare renders en cascada. El render intermedio se descarta.
  if (hydratedSessionId !== sessionId) {
    setHydratedSessionId(sessionId);
    setTextState(readStoredText(sessionId));
  }

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      writeStoredText(sessionId, next);
    },
    [sessionId],
  );

  const clear = useCallback(() => {
    setTextState('');
    writeStoredText(sessionId, '');
  }, [sessionId]);

  return { text, setText, clear, isSubmitting, queued };
};
