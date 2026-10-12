import { describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import type {
  ModelRef,
  SessionInboxUser,
  SessionMessageAssistant,
  SessionMessageInfo,
  SessionMessageUser,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { TChatWriteError } from '@app/Domains/Chat/Chat.entity';
import type { THistoryQuestion } from '@app/Domains/History';
import { queryKeys } from '@app/Domains/queryKeys';
import { renderWithProviders } from '@app/test/renderWithProviders';
import {
  useChatController,
  type TUseChatControllerResult,
} from '../useChatController';

/**
 * Specs del controlador del chat (feature 009, T019).
 *
 * `useChatController` es la **fuente única** de lógica del panel (FR-014): el
 * timeline lo proyecta `buildChatTimeline` a partir de la caché
 * (`sessions.messages`, el buffer `chatStream.for(id)` y las preguntas), el
 * envío delega en `useSendPrompt` (FR-001/FR-020) y el borrador se coordina con
 * `useChatDraft` (FR-015). El error de escritura conserva el texto para
 * reintentar (FR-022).
 *
 * Se usa `renderWithProviders` para montar el `QueryClientProvider` y sembrar la
 * caché; la fachada de escritura se mockea para espiar el envío.
 */

const write = vi.hoisted(() => ({
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
  switchAgent: vi.fn(),
  switchModel: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {},
  sessionWriteService: write,
}));

const SESSION = 'ses_1';

const sendPrompt = write.sendPrompt;
const interruptSession = write.interruptSession;
const switchAgent = write.switchAgent;
const switchModel = write.switchModel;

/** Envuelve un `SessionMessageInfo` como lo hace `normalizeMessages`. */
const msg = (info: SessionMessageInfo): TSessionMessage => ({
  info,
  parts: info.type === 'assistant' ? info.content : [],
});

const user = (
  overrides: Partial<SessionMessageUser> = {},
): SessionMessageUser => ({
  id: 'user-1',
  time: { created: 500 },
  type: 'user',
  text: 'hello',
  ...overrides,
});

const assistant = (
  content: SessionMessageAssistant['content'],
  overrides: Partial<SessionMessageAssistant> = {},
): SessionMessageAssistant => ({
  id: 'assistant-1',
  time: { created: 1000, completed: 2000 },
  type: 'assistant',
  agent: 'develop',
  model: { providerID: 'opencode', id: 'deepseek' },
  ...overrides,
  content,
});

const inbox = (delivery: SessionInboxUser['delivery']): SessionInboxUser =>
  ({ delivery } as unknown as SessionInboxUser);

interface TControllerRef {
  current: TUseChatControllerResult | null;
}

/** Monta el controlador y expone su último resultado. */
const renderController = (sessionId: string) => {
  const controller: TControllerRef = { current: null };
  const Harness = () => {
    controller.current = useChatController(sessionId);
    return null;
  };
  const view = renderWithProviders(<Harness />);
  return { controller, ...view };
};

describe('useChatController — timeline (FR-002/FR-003)', () => {
  it('proyecta el histórico consolidado y el buffer provisional de la caché', () => {
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.messages(SESSION), [
        msg(user({ id: 'u1', time: { created: 500 }, text: 'hola' })),
        msg(
          assistant([{ type: 'text', text: 'respuesta' }], {
            id: 'a1',
            time: { created: 1000, completed: 2000 },
          }),
        ),
      ]);
      view.queryClient.setQueryData(queryKeys.chatStream.for(SESSION), {
        assistantMessageID: 'a2',
        parts: { 0: { kind: 'text', text: 'en curso', at: 2000 } },
      });
    });

    const timeline = view.controller.current!.timeline;
    expect(timeline.map((entry) => entry.id)).toEqual([
      'u1:0',
      'a1:0',
      'stream:a2:0',
    ]);
    expect(timeline[2]).toMatchObject({
      role: 'agent',
      kind: 'text',
      text: 'en curso',
      isComplete: false,
    });
  });

  it('incorpora las preguntas cacheadas al timeline', () => {
    const view = renderController(SESSION);

    const question: THistoryQuestion = {
      id: 'q1',
      title: '¿Cómo?',
      fields: [],
      state: 'pending',
      answer: null,
    };
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.questions(SESSION), [
        question,
      ]);
    });

    expect(view.controller.current!.timeline).toHaveLength(1);
    expect(view.controller.current!.timeline[0]).toMatchObject({
      id: 'question:q1',
      kind: 'question',
      text: '¿Cómo?',
    });
  });

  it('arranca con un timeline vacío sin datos cacheados', () => {
    const view = renderController(SESSION);

    expect(view.controller.current!.timeline).toEqual([]);
  });
});

describe('useChatController — estado busy (FR-020)', () => {
  it('deriva busy del mapa global de estados', async () => {
    const view = renderController(SESSION);

    expect(view.controller.current!.busy).toBe(false);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    await waitFor(() => expect(view.controller.current!.busy).toBe(true));
  });

  it('no está busy con la sesión ociosa', () => {
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'idle' },
      });
    });

    expect(view.controller.current!.busy).toBe(false);
  });
});

describe('useChatController — envío (FR-001/FR-020)', () => {
  it('envía sin cola (steer) cuando la sesión está ociosa', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'idle' },
      });
    });

    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() =>
      expect(sendPrompt).toHaveBeenCalledWith({
        sessionID: SESSION,
        text: 'hola',
        queue: false,
      }),
    );
  });

  it('envía con queue cuando la sesión está busy y lo marca como queued', async () => {
    sendPrompt.mockResolvedValue(inbox('queue'));
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    act(() => {
      view.controller.current!.send('mientras trabaja');
    });

    await waitFor(() =>
      expect(sendPrompt).toHaveBeenCalledWith({
        sessionID: SESSION,
        text: 'mientras trabaja',
        queue: true,
      }),
    );
    await waitFor(() => expect(view.controller.current!.queued).toBe(true));
  });

  it('ignora un texto vacío o solo espacios', () => {
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.send('   ');
    });

    expect(sendPrompt).not.toHaveBeenCalled();
  });
});

describe('useChatController — borrador y error (FR-015/FR-022)', () => {
  it('limpia el borrador tras un envío exitoso', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setText('a enviar');
    });
    expect(view.controller.current!.text).toBe('a enviar');

    act(() => {
      view.controller.current!.send('a enviar');
    });

    await waitFor(() => expect(view.controller.current!.text).toBe(''));
  });

  it('conserva el texto y expone el error si la escritura falla', async () => {
    sendPrompt.mockRejectedValue(new TChatWriteError('sdk', 'boom'));
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setText('reintentable');
    });

    act(() => {
      view.controller.current!.send('reintentable');
    });

    await waitFor(() => expect(view.controller.current!.error).not.toBeNull());
    expect(view.controller.current!.text).toBe('reintentable');
    expect(view.controller.current!.error).toBeInstanceOf(TChatWriteError);
  });
});

describe('useChatController — invalidación del timeline', () => {
  it('invalida los mensajes de la sesión tras enviar', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderController(SESSION);
    const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');

    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.sessions.messages(SESSION),
      }),
    );
  });
});

describe('useChatController — interrupción (FR-004)', () => {
  it('expone canInterrupt según el estado busy de la sesión', async () => {
    const view = renderController(SESSION);

    expect(view.controller.current!.canInterrupt).toBe(false);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    await waitFor(() =>
      expect(view.controller.current!.canInterrupt).toBe(true),
    );
  });

  it('interrupt() llama al service con el sessionID de la sesión abierta', async () => {
    interruptSession.mockResolvedValue({ interrupted: true });
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    act(() => {
      view.controller.current!.interrupt();
    });

    await waitFor(() => expect(interruptSession).toHaveBeenCalledWith(SESSION));
  });

  it('expone isInterrupting mientras la interrupción está en vuelo', async () => {
    let resolve!: (value: { interrupted: boolean }) => void;
    interruptSession.mockReturnValue(
      new Promise<{ interrupted: boolean }>((r) => {
        resolve = r;
      }),
    );
    const view = renderController(SESSION);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [SESSION]: { type: 'busy' },
      });
    });

    act(() => {
      view.controller.current!.interrupt();
    });

    await waitFor(() =>
      expect(view.controller.current!.isInterrupting).toBe(true),
    );

    await act(async () => {
      resolve({ interrupted: true });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(view.controller.current!.isInterrupting).toBe(false),
    );
  });

  it('no interrumpe si la sesión ya no está en curso', async () => {
    const view = renderController(SESSION);

    await act(async () => {
      view.controller.current!.interrupt();
      await Promise.resolve();
    });

    expect(interruptSession).not.toHaveBeenCalled();
  });
});

describe('useChatController — selección antes del envío (FR-008, W7)', () => {
  /**
   * La selección activa de agente/modelo/razonamiento (`TChatSelection`) se
   * aplica con `switchAgent`/`switchModel` **solo si cambió** respecto al estado
   * vigente, y **antes** de `sendPrompt` (data-model §2.5; research R7;
   * write-facade-contract §W7). La aplicación pasa por `useSetSelection`, que
   * delega en la fachada `sessionWriteService` (mockeada aquí, como el resto de
   * la spec). `setAgent(null)`/`setModel(null)` significan "no cambiar".
   */

  const MODEL_A: ModelRef = { id: 'deepseek', providerID: 'opencode' };
  const MODEL_B: ModelRef = {
    id: 'gpt',
    providerID: 'opencode',
    variant: 'high',
  };

  it('no aplica switch si la selección no cambió', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(switchAgent).not.toHaveBeenCalled();
    expect(switchModel).not.toHaveBeenCalled();
  });

  it('aplica switchAgent antes de prompt cuando cambia el agente', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    switchAgent.mockResolvedValue(undefined);
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setAgent('build');
    });
    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(switchAgent).toHaveBeenCalledWith(SESSION, 'build');
    expect(switchAgent.mock.invocationCallOrder[0]).toBeLessThan(
      sendPrompt.mock.invocationCallOrder[0],
    );
  });

  it('aplica switchModel con la variante antes de prompt cuando cambia el modelo', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    switchModel.mockResolvedValue(undefined);
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setModel(MODEL_B);
    });
    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(switchModel).toHaveBeenCalledWith(SESSION, MODEL_B);
    expect(switchModel.mock.invocationCallOrder[0]).toBeLessThan(
      sendPrompt.mock.invocationCallOrder[0],
    );
  });

  it('aplica agente y modelo (en ese orden) antes de prompt', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    switchAgent.mockResolvedValue(undefined);
    switchModel.mockResolvedValue(undefined);
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setAgent('build');
      view.controller.current!.setModel(MODEL_A);
    });
    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(switchAgent).toHaveBeenCalledWith(SESSION, 'build');
    expect(switchModel).toHaveBeenCalledWith(SESSION, MODEL_A);
    expect(switchAgent.mock.invocationCallOrder[0]).toBeLessThan(
      switchModel.mock.invocationCallOrder[0],
    );
    expect(switchModel.mock.invocationCallOrder[0]).toBeLessThan(
      sendPrompt.mock.invocationCallOrder[0],
    );
  });

  it('solo reaplica la selección cuando vuelve a cambiar', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    switchAgent.mockResolvedValue(undefined);
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setAgent('build');
    });
    act(() => {
      view.controller.current!.send('uno');
    });
    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));

    act(() => {
      view.controller.current!.send('dos');
    });
    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(2));

    expect(switchAgent).toHaveBeenCalledTimes(1);
  });

  it('expone la selección activa y su estado isDirty', () => {
    const view = renderController(SESSION);

    expect(view.controller.current!.selection.isDirty).toBe(false);

    act(() => {
      view.controller.current!.setAgent('build');
    });

    expect(view.controller.current!.selection.agent).toBe('build');
    expect(view.controller.current!.selection.isDirty).toBe(true);
  });

  it('no marca dirty al volver al valor vigente (null = no cambiar)', async () => {
    sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderController(SESSION);

    act(() => {
      view.controller.current!.setAgent('build');
      view.controller.current!.setAgent(null);
    });
    act(() => {
      view.controller.current!.send('hola');
    });

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(switchAgent).not.toHaveBeenCalled();
  });
});
