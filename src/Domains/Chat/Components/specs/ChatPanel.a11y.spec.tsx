import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '@app/Domains/queryKeys';
import { renderWithProviders } from '@app/test/renderWithProviders';
import {
  TURN_FINISHED_ANNOUNCEMENT,
  TURN_IN_PROGRESS_ANNOUNCEMENT,
} from '../ChatTimeline';
import { ChatPanel } from '../ChatPanel';

/**
 * Spec a11y del chat (T066, FR-021, SC-008).
 *
 * Complementa —sin repetir— las specs existentes: `ChatComposer.spec.tsx` cubre
 * `aria-busy` en aislamiento y `ChatTimeline.spec.tsx` el contenido del anuncio
 * de turno. Aquí se verifican las aserciones de accesibilidad que faltaban, a
 * nivel de **integración** (con `renderWithProviders`):
 *   - `aria-busy` refleja el **reposo** (`false`) en Enviar/Detener y el estado
 *     ocupado del **compositor** completo (el `<form>`), no solo el botón.
 *   - La live region de inicio/fin de turno es `role="status"`, `aria-live`
 *     `polite` y `sr-only`, y **nunca** filtra el texto del delta (FR-021).
 */

const write = vi.hoisted(() => ({
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
  replyPermission: vi.fn(),
  replyForm: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {},
  sessionWriteService: write,
}));

/** Estado de conexión del stream (FR-012): el panel lo lee del provider. */
const connection = vi.hoisted(() => ({ state: 'connected' as const }));

vi.mock('@app/Infrastructure/EventStreamProvider', () => ({
  useEventStream: () => ({ state: connection.state }),
  EventStreamProvider: ({ children }: { children: ReactNode }) => children,
}));

/**
 * El compositor monta un Radix `AlertDialog` (FR-004); jsdom no implementa las
 * APIs de puntero que Radix usa al abrir el diálogo. Se mockean como en
 * `ChatComposer.spec.tsx`.
 */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const SESSION = 'ses_a11y';

const assistantMessage = (text: string): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id: 'a1',
    time: { created: 1000, completed: 2000 },
    type: 'assistant',
    agent: 'develop',
    model: { providerID: 'opencode', id: 'deepseek' },
    content: [{ type: 'text', text }],
  };
  return { info, parts: info.content };
};

const renderPanel = () =>
  renderWithProviders(<ChatPanel sessionId={SESSION} />);

const getTextarea = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Mensaje' });
const getSendButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Enviar' });
const getStopButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Detener' });

describe('ChatPanel — aria-busy de los controles (T066, FR-021)', () => {
  it('expone aria-busy="false" en Enviar y Detener en reposo', () => {
    renderPanel();

    // `aria-busy` refleja el estado: en reposo es `false`, no un valor pegado.
    expect(getSendButton()).toHaveAttribute('aria-busy', 'false');
    expect(getStopButton()).toHaveAttribute('aria-busy', 'false');
  });

  it('marca el compositor como ocupado (aria-busy) mientras el envío está en vuelo', async () => {
    // Envío que nunca resuelve: mantiene la mutation en `isPending`.
    write.sendPrompt.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPanel();

    await user.type(getTextarea(), 'hola');
    await user.click(getSendButton());

    await waitFor(() =>
      expect(getSendButton()).toHaveAttribute('aria-busy', 'true'),
    );
    // El `<form>` del compositor también anuncia el estado ocupado.
    expect(getTextarea().closest('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('anuncia aria-busy en Detener mientras la interrupción está en vuelo', async () => {
    write.interruptSession.mockReturnValue(new Promise(() => {}));
    const view = renderPanel();

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const stop = getStopButton();
    await user.click(stop);
    await user.click(
      await screen.findByRole('button', { name: 'Detener turno' }),
    );

    await waitFor(() => expect(stop).toHaveAttribute('aria-busy', 'true'));
  });
});

describe('ChatPanel — live region de turno (T066, FR-021)', () => {
  it('anuncia el inicio de turno en una live region polite, oculta y sin el delta', () => {
    const view = renderPanel();

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.messages(SESSION), []);
      view.queryClient.setQueryData(queryKeys.chatStream.for(SESSION), {
        assistantMessageID: 'a2',
        parts: {
          0: { kind: 'text', text: 'delta secreto en curso', at: 2000 },
        },
      });
    });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    // La región es solo para lectores de pantalla (`sr-only`).
    expect(status).toHaveClass('sr-only');
    expect(status).toHaveTextContent(TURN_IN_PROGRESS_ANNOUNCEMENT);
    // Nunca se anuncia el texto del delta (no se repite en cada delta).
    expect(status).not.toHaveTextContent('delta secreto');
  });

  it('anuncia el fin de turno al consolidarse, sin filtrar la respuesta', () => {
    const view = renderPanel();

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.messages(SESSION), [
        assistantMessage('respuesta consolidada'),
      ]);
    });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(TURN_FINISHED_ANNOUNCEMENT);
    expect(status).not.toHaveTextContent('respuesta consolidada');
  });
});
