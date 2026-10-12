import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  AgentInfo,
  FormInfo,
  ModelInfo,
  ModelRef,
  PermissionRequest,
  SessionInboxUser,
  SessionInterruptResponse,
  SessionStatus,
} from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  TChatWriteError,
  type TAgentOption,
  type TModelOption,
} from '../Chat.entity';
import {
  isSessionBusy,
  useAgentOptions,
  useCachedQueryData,
  useInterruptSession,
  useModelOptions,
  useReplyForm,
  useReplyPermission,
  useSendPrompt,
  useSetSelection,
} from '../Chat.service';

/**
 * Spec del servicio del dominio Chat (`Chat.service.ts`, feature 009).
 *
 * Cubre las reglas de la fachada de escritura que aún no tenían spec directo
 * (contratos `write-facade-contract.md` §3–§6 y `chat-panel-contract.md` §3):
 * - Decisión `steer`/`queue` por estado `busy` y `queued` de retorno (FR-020).
 * - Interrupción guardada por `busy`, sin tocar el SDK si ya no está en curso
 *   (FR-004).
 * - **Revalidación** del pendiente antes de responder y aviso si ya se resolvió
 *   (FR-006, W8); origen = sesión hija (FR-007).
 * - Limpieza de las tres claves del pendiente tras responder (FR-011).
 * - Fallo de escritura → aviso accesible (toast `warning`/`error`, FR-022).
 * - Catálogo de modelos/agentes proyectado por `select` (FR-008).
 * - Selección aplicada solo si cambió (`null` = no cambiar, W7).
 * - Lector reactivo `useCachedQueryData` (fuente del timeline/buffer).
 *
 * Se mockean las dos fronteras de datos (fachada de escritura y catálogo) y
 * `sonner`; la revalidación se ejercita sembrando la caché de `QueryClient`, que
 * es justo lo que el servicio lee en el momento de la mutation.
 */

const write = vi.hoisted(() => ({
  sendPrompt: vi.fn(),
  interruptSession: vi.fn(),
  replyPermission: vi.fn(),
  replyForm: vi.fn(),
  switchAgent: vi.fn(),
  switchModel: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {},
  sessionWriteService: write,
}));

const catalog = vi.hoisted(() => ({
  listModels: vi.fn(),
  listAgents: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/catalog.service', () => ({
  catalogReadService: catalog,
}));

const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast }));

const SESSION = 'ses_1';
const ORIGIN = 'ses_child';

/** Monta un hook de servicio con un `QueryClient` sembrable y aislado. */
const renderServiceHook = <T,>(hook: () => T) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(hook, { wrapper });
  return { ...rendered, queryClient };
};

/** Ejecuta una mutation capturando su rechazo sin romper el test. */
const runMutation = async (run: () => Promise<unknown>): Promise<unknown> => {
  let error: unknown;
  await act(async () => {
    try {
      await run();
    } catch (caught) {
      error = caught;
    }
  });
  return error;
};

const statuses = (status: SessionStatus): Record<string, SessionStatus> => ({
  [SESSION]: status,
});

const inbox = (delivery: SessionInboxUser['delivery']): SessionInboxUser =>
  ({ delivery } as unknown as SessionInboxUser);

const permission = (
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, 'id' | 'sessionID'>,
): PermissionRequest => ({
  action: 'bash',
  resources: ['rm -rf /tmp/build'],
  ...overrides,
});

const question = (
  overrides: Partial<TQuestionEntry> = {},
): TQuestionEntry => ({
  id: 'form_1',
  title: '¿Continuar?',
  fields: [],
  state: 'pending',
  answer: null,
  ...overrides,
});

const formInfo = (
  overrides: Partial<FormInfo> & Pick<FormInfo, 'id' | 'sessionID'>,
): FormInfo => ({
  title: '¿Continuar?',
  fields: [{ key: 'name', type: 'string' }],
  ...overrides,
});

const modelInfo = (overrides: Partial<ModelInfo> = {}): ModelInfo =>
  ({
    id: 'gpt-5',
    name: 'GPT-5',
    providerID: 'openai',
    variants: [],
    ...overrides,
  }) as unknown as ModelInfo;

const agentInfo = (overrides: Partial<AgentInfo> = {}): AgentInfo =>
  ({ id: 'build', name: 'Build', ...overrides }) as unknown as AgentInfo;

describe('isSessionBusy', () => {
  it('es true solo con el estado busy', () => {
    expect(isSessionBusy({ type: 'busy' })).toBe(true);
    expect(isSessionBusy({ type: 'idle' })).toBe(false);
    expect(isSessionBusy(undefined)).toBe(false);
  });
});

describe('useSendPrompt — entrega steer/queue (FR-020)', () => {
  it('envía sin cola y devuelve queued:false con la sesión ociosa', async () => {
    write.sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderServiceHook(() => useSendPrompt(SESSION));
    view.queryClient.setQueryData(queryKeys.sessions.status(), statuses({ type: 'idle' }));

    let result: { queued: boolean } | undefined;
    await act(async () => {
      result = await view.result.current.mutateAsync('hola');
    });

    expect(write.sendPrompt).toHaveBeenCalledWith({
      sessionID: SESSION,
      text: 'hola',
      queue: false,
    });
    expect(result).toEqual({ queued: false });
  });

  it('encola (queue) y marca queued:true cuando la sesión está busy', async () => {
    write.sendPrompt.mockResolvedValue(inbox('queue'));
    const view = renderServiceHook(() => useSendPrompt(SESSION));
    view.queryClient.setQueryData(queryKeys.sessions.status(), statuses({ type: 'busy' }));

    let result: { queued: boolean } | undefined;
    await act(async () => {
      result = await view.result.current.mutateAsync('mientras trabaja');
    });

    expect(write.sendPrompt).toHaveBeenCalledWith({
      sessionID: SESSION,
      text: 'mientras trabaja',
      queue: true,
    });
    expect(result).toEqual({ queued: true });
  });

  it('invalida los mensajes de la sesión tras el éxito (FR-001)', async () => {
    write.sendPrompt.mockResolvedValue(inbox('steer'));
    const view = renderServiceHook(() => useSendPrompt(SESSION));
    const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');

    await act(async () => {
      await view.result.current.mutateAsync('hola');
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.messages(SESSION),
    });
  });

  it('propaga el fallo de la fachada (FR-022)', async () => {
    write.sendPrompt.mockRejectedValue(new TChatWriteError('sdk', 'boom'));
    const view = renderServiceHook(() => useSendPrompt(SESSION));

    const error = await runMutation(() => view.result.current.mutateAsync('hola'));

    expect(error).toBeInstanceOf(TChatWriteError);
  });
});

describe('useInterruptSession — solo el turno abierto (FR-004)', () => {
  it('no toca el SDK y falla la validación si la sesión ya no está en curso', async () => {
    const view = renderServiceHook(() => useInterruptSession(SESSION));
    view.queryClient.setQueryData(queryKeys.sessions.status(), statuses({ type: 'idle' }));

    const error = await runMutation(() => view.result.current.mutateAsync());

    expect(error).toMatchObject({ code: 'validation' });
    expect(write.interruptSession).not.toHaveBeenCalled();
  });

  it('interrumpe con el sessionID de la sesión abierta cuando está busy', async () => {
    const response: SessionInterruptResponse = { interrupted: true };
    write.interruptSession.mockResolvedValue(response);
    const view = renderServiceHook(() => useInterruptSession(SESSION));
    view.queryClient.setQueryData(queryKeys.sessions.status(), statuses({ type: 'busy' }));

    let result: SessionInterruptResponse | undefined;
    await act(async () => {
      result = await view.result.current.mutateAsync();
    });

    expect(write.interruptSession).toHaveBeenCalledWith(SESSION);
    expect(result).toEqual(response);
  });
});

describe('useReplyPermission — revalidación y origen (FR-005/FR-006/FR-007)', () => {
  const vars = {
    sessionID: ORIGIN,
    requestID: 'per_1',
    decision: 'always' as const,
  };

  it('responde con el sessionID de origen si el permiso sigue abierto (FR-007)', async () => {
    write.replyPermission.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useReplyPermission());
    view.queryClient.setQueryData(queryKeys.permissions.list(), [
      permission({ id: 'per_1', sessionID: ORIGIN }),
    ]);

    await act(async () => {
      await view.result.current.mutateAsync(vars);
    });

    expect(write.replyPermission).toHaveBeenCalledWith({
      sessionID: ORIGIN,
      requestID: 'per_1',
      decision: 'always',
    });
  });

  it('no llama al SDK y avisa si el permiso ya se resolvió (FR-006, W8)', async () => {
    const view = renderServiceHook(() => useReplyPermission());
    view.queryClient.setQueryData(queryKeys.permissions.list(), []);

    const error = await runMutation(() => view.result.current.mutateAsync(vars));

    expect(error).toMatchObject({ code: 'validation' });
    expect(write.replyPermission).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('El permiso ya no está abierto');
  });

  it('no considera abierto un permiso del mismo id en otra sesión', async () => {
    const view = renderServiceHook(() => useReplyPermission());
    view.queryClient.setQueryData(queryKeys.permissions.list(), [
      permission({ id: 'per_1', sessionID: 'ses_other' }),
    ]);

    const error = await runMutation(() => view.result.current.mutateAsync(vars));

    expect(error).toMatchObject({ code: 'validation' });
    expect(write.replyPermission).not.toHaveBeenCalled();
  });

  it('limpia las tres claves del pendiente tras responder (FR-011)', async () => {
    write.replyPermission.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useReplyPermission());
    view.queryClient.setQueryData(queryKeys.permissions.list(), [
      permission({ id: 'per_1', sessionID: ORIGIN }),
    ]);
    const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');

    await act(async () => {
      await view.result.current.mutateAsync(vars);
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.permissions.list(),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.permissions.for(ORIGIN),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.forms(ORIGIN),
    });
  });

  it('avisa un fallo del SDK como toast de error (FR-022)', async () => {
    write.replyPermission.mockRejectedValue(
      new TChatWriteError('sdk', 'reply boom'),
    );
    const view = renderServiceHook(() => useReplyPermission());
    view.queryClient.setQueryData(queryKeys.permissions.list(), [
      permission({ id: 'per_1', sessionID: ORIGIN }),
    ]);

    await runMutation(() => view.result.current.mutateAsync(vars));

    expect(toast.error).toHaveBeenCalledWith('reply boom');
  });
});

describe('useReplyForm — revalidación de la pregunta (FR-005/FR-006)', () => {
  const vars = {
    sessionID: ORIGIN,
    formID: 'form_1',
    answer: { name: 'Ada' },
  };

  it('responde si la pregunta sigue pending', async () => {
    write.replyForm.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useReplyForm());
    view.queryClient.setQueryData(queryKeys.sessions.questions(ORIGIN), [
      question({ id: 'form_1' }),
    ]);

    await act(async () => {
      await view.result.current.mutateAsync(vars);
    });

    expect(write.replyForm).toHaveBeenCalledWith({
      sessionID: ORIGIN,
      formID: 'form_1',
      answer: { name: 'Ada' },
    });
  });

  it('no llama al SDK si la pregunta ya se resolvió (FR-006)', async () => {
    const view = renderServiceHook(() => useReplyForm());
    view.queryClient.setQueryData(queryKeys.sessions.questions(ORIGIN), [
      question({ id: 'form_1', state: 'answered', answer: 'Ada' }),
    ]);

    const error = await runMutation(() => view.result.current.mutateAsync(vars));

    expect(error).toMatchObject({ code: 'validation' });
    expect(write.replyForm).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('La pregunta ya no está abierta');
  });

  it('cae a la lista cruda de formularios si las preguntas no están cacheadas', async () => {
    write.replyForm.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useReplyForm());
    view.queryClient.setQueryData(queryKeys.sessions.forms(ORIGIN), [
      formInfo({ id: 'form_1', sessionID: ORIGIN }),
    ]);

    await act(async () => {
      await view.result.current.mutateAsync(vars);
    });

    expect(write.replyForm).toHaveBeenCalledTimes(1);
  });

  it('no llama al SDK si la pregunta no existe en ninguna caché', async () => {
    const view = renderServiceHook(() => useReplyForm());

    const error = await runMutation(() => view.result.current.mutateAsync(vars));

    expect(error).toMatchObject({ code: 'validation' });
    expect(write.replyForm).not.toHaveBeenCalled();
  });

  it('limpia las tres claves del pendiente tras responder (FR-011)', async () => {
    write.replyForm.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useReplyForm());
    view.queryClient.setQueryData(queryKeys.sessions.questions(ORIGIN), [
      question({ id: 'form_1' }),
    ]);
    const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');

    await act(async () => {
      await view.result.current.mutateAsync(vars);
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.permissions.list(),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.permissions.for(ORIGIN),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.forms(ORIGIN),
    });
  });
});

describe('useModelOptions / useAgentOptions — catálogo (FR-008)', () => {
  it('proyecta los modelos con sus variantes de razonamiento (FR-008)', async () => {
    catalog.listModels.mockResolvedValue([
      modelInfo({ variants: [{ id: 'high' }] }),
    ]);
    const view = renderServiceHook(() => useModelOptions('/repo'));

    await waitFor(() => expect(view.result.current.data).toBeDefined());

    expect(catalog.listModels).toHaveBeenCalledWith('/repo');
    expect(view.result.current.data).toEqual<TModelOption[]>([
      {
        id: 'gpt-5',
        label: 'GPT-5',
        ref: { id: 'gpt-5', providerID: 'openai' },
        reasoning: [{ value: 'high', label: 'high' }],
      },
    ]);
  });

  it('no consulta el catálogo de modelos sin directory', () => {
    renderServiceHook(() => useModelOptions(null));

    expect(catalog.listModels).not.toHaveBeenCalled();
  });

  it('proyecta los agentes a {id, label}', async () => {
    catalog.listAgents.mockResolvedValue([
      agentInfo({ id: 'plan', name: 'Plan' }),
    ]);
    const view = renderServiceHook(() => useAgentOptions('/repo'));

    await waitFor(() => expect(view.result.current.data).toBeDefined());

    expect(catalog.listAgents).toHaveBeenCalledWith('/repo');
    expect(view.result.current.data).toEqual<TAgentOption[]>([
      { id: 'plan', label: 'Plan' },
    ]);
  });
});

describe('useSetSelection — aplicar solo lo que cambió (W7)', () => {
  it('aplica switchAgent solo con el agente elegido', async () => {
    write.switchAgent.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useSetSelection(SESSION));

    await act(async () => {
      await view.result.current.mutateAsync({
        agent: 'build',
        model: null,
        isDirty: false,
      });
    });

    expect(write.switchAgent).toHaveBeenCalledWith(SESSION, 'build');
    expect(write.switchModel).not.toHaveBeenCalled();
  });

  it('aplica switchModel solo con el modelo elegido', async () => {
    const model: ModelRef = { id: 'gpt-5', providerID: 'openai' };
    write.switchModel.mockResolvedValue(undefined);
    const view = renderServiceHook(() => useSetSelection(SESSION));

    await act(async () => {
      await view.result.current.mutateAsync({
        agent: null,
        model,
        isDirty: false,
      });
    });

    expect(write.switchModel).toHaveBeenCalledWith(SESSION, model);
    expect(write.switchAgent).not.toHaveBeenCalled();
  });

  it('no toca el SDK con la selección vacía (null = no cambiar)', async () => {
    const view = renderServiceHook(() => useSetSelection(SESSION));

    await act(async () => {
      await view.result.current.mutateAsync({
        agent: null,
        model: null,
        isDirty: false,
      });
    });

    expect(write.switchAgent).not.toHaveBeenCalled();
    expect(write.switchModel).not.toHaveBeenCalled();
  });
});

describe('useCachedQueryData — lector reactivo de la caché', () => {
  const KEY = queryKeys.chatStream.for(SESSION);

  it('devuelve el valor cacheado y reacciona a un setQueryData de su clave', () => {
    const view = renderServiceHook(() =>
      useCachedQueryData<{ value: string }>(KEY),
    );

    expect(view.result.current).toBeUndefined();

    act(() => {
      view.queryClient.setQueryData(KEY, { value: 'a' });
    });

    expect(view.result.current).toEqual({ value: 'a' });
  });

  it('ignora un setQueryData de otra clave', () => {
    const view = renderServiceHook(() =>
      useCachedQueryData<{ value: string }>(KEY),
    );

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.messages(SESSION), [
        { value: 'otro' },
      ]);
    });

    expect(view.result.current).toBeUndefined();
  });
});
