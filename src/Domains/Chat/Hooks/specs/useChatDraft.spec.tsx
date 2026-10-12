import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  CHAT_DRAFT_KEY_PREFIX,
  chatDraftKey,
  useChatDraft,
} from '../useChatDraft';

/**
 * Specs del borrador persistido del compositor (feature 009, T017).
 *
 * Contrato `chat-panel-contract.md §4` (P5): el texto vive en
 * `localStorage['chat.draft.<sessionId>']`, se rehidrata al montar y sobrevive
 * al remontaje del panel (FR-015, SC-006). El valor se siembra **antes** de
 * renderizar para probar la rehidratación; `setup.ts` limpia el almacenamiento
 * entre tests. `isSubmitting`/`queued` son transitorios y se inyectan.
 */

const SESSION = 'ses_1';

describe('useChatDraft — rehidratación (FR-015)', () => {
  it('arranca vacío cuando no hay borrador guardado', () => {
    const { result } = renderHook(() => useChatDraft(SESSION));

    expect(result.current.text).toBe('');
  });

  it('rehidrata el texto guardado al montar', () => {
    window.localStorage.setItem(chatDraftKey(SESSION), 'hola mundo');

    const { result } = renderHook(() => useChatDraft(SESSION));

    expect(result.current.text).toBe('hola mundo');
  });

  it('compone la clave por sesión con el prefijo del contrato', () => {
    expect(CHAT_DRAFT_KEY_PREFIX).toBe('chat.draft.');
    expect(chatDraftKey(SESSION)).toBe('chat.draft.ses_1');
  });

  it('aísla el borrador por sesión', () => {
    window.localStorage.setItem(chatDraftKey('ses_a'), 'borrador A');

    const { result } = renderHook(() => useChatDraft('ses_b'));

    expect(result.current.text).toBe('');
  });

  it('relee el borrador cuando cambia la sesión', () => {
    window.localStorage.setItem(chatDraftKey('ses_a'), 'borrador A');
    window.localStorage.setItem(chatDraftKey('ses_b'), 'borrador B');

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => useChatDraft(sessionId),
      { initialProps: { sessionId: 'ses_a' } },
    );

    expect(result.current.text).toBe('borrador A');

    rerender({ sessionId: 'ses_b' });

    expect(result.current.text).toBe('borrador B');
  });
});

describe('useChatDraft — setText (FR-015)', () => {
  it('actualiza el texto y lo persiste', () => {
    const { result } = renderHook(() => useChatDraft(SESSION));

    act(() => result.current.setText('nuevo borrador'));

    expect(result.current.text).toBe('nuevo borrador');
    expect(window.localStorage.getItem(chatDraftKey(SESSION))).toBe(
      'nuevo borrador',
    );
  });

  it('elimina la clave al vaciar el texto', () => {
    window.localStorage.setItem(chatDraftKey(SESSION), 'algo');

    const { result } = renderHook(() => useChatDraft(SESSION));

    act(() => result.current.setText(''));

    expect(result.current.text).toBe('');
    expect(window.localStorage.getItem(chatDraftKey(SESSION))).toBeNull();
  });
});

describe('useChatDraft — clear (FR-015)', () => {
  it('vacía el texto y elimina el borrador persistido', () => {
    window.localStorage.setItem(chatDraftKey(SESSION), 'pendiente de enviar');

    const { result } = renderHook(() => useChatDraft(SESSION));

    act(() => result.current.clear());

    expect(result.current.text).toBe('');
    expect(window.localStorage.getItem(chatDraftKey(SESSION))).toBeNull();
  });
});

describe('useChatDraft — supervivencia al remontaje (FR-015, SC-006)', () => {
  it('restaura el borrador tras desmontar y volver a montar el panel', () => {
    const first = renderHook(() => useChatDraft(SESSION));

    act(() => first.result.current.setText('texto a medio escribir'));
    first.unmount();

    const second = renderHook(() => useChatDraft(SESSION));

    expect(second.result.current.text).toBe('texto a medio escribir');
  });

  /**
   * T061: al cambiar de pestaña/vista el panel puede reusarse entre sesiones; el
   * borrador de cada una debe conservarse (y no contaminar a la otra) al volver
   * a ella, rehidratándolo desde `localStorage` (FR-015, SC-006).
   */
  it('conserva el borrador de cada sesión al alternar entre ellas (vista reusada)', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => useChatDraft(sessionId),
      { initialProps: { sessionId: 'ses_a' } },
    );

    act(() => result.current.setText('borrador A'));

    rerender({ sessionId: 'ses_b' });
    expect(result.current.text).toBe('');

    act(() => result.current.setText('borrador B'));

    rerender({ sessionId: 'ses_a' });
    expect(result.current.text).toBe('borrador A');
    expect(window.localStorage.getItem(chatDraftKey('ses_a'))).toBe('borrador A');

    rerender({ sessionId: 'ses_b' });
    expect(result.current.text).toBe('borrador B');
    expect(window.localStorage.getItem(chatDraftKey('ses_b'))).toBe('borrador B');
  });
});

describe('useChatDraft — estado transitorio de envío (data-model §2.6)', () => {
  it('expone isSubmitting y queued en false por defecto y no los persiste', () => {
    const { result } = renderHook(() => useChatDraft(SESSION));

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.queued).toBe(false);
    expect(window.localStorage.getItem(chatDraftKey(SESSION))).toBeNull();
  });

  it('re-expone isSubmitting y queued inyectados por el controlador', () => {
    const { result } = renderHook(() =>
      useChatDraft(SESSION, { isSubmitting: true, queued: true }),
    );

    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.queued).toBe(true);
  });
});
