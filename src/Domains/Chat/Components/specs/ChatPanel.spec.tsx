import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type {
  AgentInfo,
  ModelInfo,
  PermissionRequest,
  SessionMessageAssistant,
  SessionMessageInfo,
  SessionMessageUser,
} from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '@app/Domains/queryKeys';
import { renderWithProviders } from '@app/test/renderWithProviders';
import type { TAttentionItem } from '../../Chat.entity';
import { chatDraftKey } from '../../Hooks/useChatDraft';
import type { TChatSelectionSeed } from '../../Hooks/useChatController';
import {
  ChatAttentionBadge,
  ChatPanel,
  type TChatPendingItem,
} from '../ChatPanel';

/**
 * Spec del orquestador base del chat (feature 009, T023, US1).
 *
 * `ChatPanel` compone `ChatTimeline` + `ChatComposer` sobre la sesión abierta,
 * con toda la lógica en `useChatController` (FR-014). Se usa
 * `renderWithProviders` para montar el `QueryClientProvider` y sembrar la caché;
 * la fachada de escritura se mockea para espiar el envío. Los estados de pantalla
 * completos (US6) se añaden en tareas posteriores.
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

/**
 * Catálogo del selector (FR-008): `useModelOptions`/`useAgentOptions` leen de
 * `catalogReadService` (SDK scopeado por `directory`). Se mockea para poder
 * ejercer el catálogo sin red y verificar el scope por directorio (T077).
 */
const catalog = vi.hoisted(() => ({
  listModels: vi.fn(),
  listAgents: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/catalog.service', () => ({
  catalogReadService: catalog,
}));

/**
 * Estado de conexión del stream en vivo (FR-012). `ChatPanel` lee
 * `useEventStream` del `EventStreamProvider`; en tests se mockea como hace
 * `ConnectionBadge.spec.tsx` con `useConnectionStatus`, para poder simular
 * `connected`/`disconnected`/`reconnecting` sin abrir un stream real.
 */
type TTestConnectionState = 'connected' | 'reconnecting' | 'disconnected';

const connection = vi.hoisted(
  (): { state: TTestConnectionState } => ({ state: 'connected' }),
);

vi.mock('@app/Infrastructure/EventStreamProvider', () => ({
  useEventStream: () => ({ state: connection.state }),
  EventStreamProvider: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  connection.state = 'connected';
});

const SESSION = 'ses_1';

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
  text: 'hola',
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

const renderPanel = (sessionId: string = SESSION) =>
  renderWithProviders(<ChatPanel sessionId={sessionId} />);

const getTextarea = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Mensaje' });

describe('ChatPanel — composición del orquestador (T023, FR-014)', () => {
  it('compone el timeline y el compositor sobre la sesión abierta', () => {
    renderPanel();

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('chat-timeline')).toBeInTheDocument();
    expect(getTextarea()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('proyecta los mensajes cacheados de la sesión en el timeline (FR-002)', () => {
    const view = renderPanel();

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
    });

    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.getByText('respuesta')).toBeInTheDocument();
  });

  it('muestra la parte provisional del buffer en texto plano ("En curso")', () => {
    const view = renderPanel();

    act(() => {
      view.queryClient.setQueryData(queryKeys.chatStream.for(SESSION), {
        assistantMessageID: 'a2',
        parts: { 0: { kind: 'text', text: 'en curso', at: 2000 } },
      });
    });

    expect(screen.getByText('en curso')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
  });
});

describe('ChatPanel — envío desde el compositor (T023, FR-001)', () => {
  it('envía el borrador a la sesión abierta', async () => {
    write.sendPrompt.mockResolvedValue({ delivery: 'steer' });
    const userEventSetup = userEvent.setup();
    renderPanel();

    await userEventSetup.type(getTextarea(), 'hola');
    await userEventSetup.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(write.sendPrompt).toHaveBeenCalledWith({
        sessionID: SESSION,
        text: 'hola',
        queue: false,
      }),
    );
  });

  it('rehidrata el borrador persistido por sesión (FR-015)', () => {
    window.localStorage.setItem(chatDraftKey(SESSION), 'borrador previo');

    renderPanel();

    expect(getTextarea()).toHaveValue('borrador previo');
  });

  it('no envía texto vacío (FR-001)', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(write.sendPrompt).not.toHaveBeenCalled();
  });

  it('avisa de forma accesible y conserva el borrador si el envío falla (FR-022)', async () => {
    write.sendPrompt.mockRejectedValue(new Error('fallo de red'));
    const userEventSetup = userEvent.setup();
    renderPanel();

    await userEventSetup.type(getTextarea(), 'reintentable');
    await userEventSetup.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('fallo de red');
    expect(getTextarea()).toHaveValue('reintentable');
  });
});

/**
 * Supervivencia del borrador al remontaje (T061, FR-015, SC-006): al cambiar de
 * pestaña/vista —o al rotar el dispositivo— la presentación del chat se
 * desmonta y vuelve a montarse; el texto escrito debe rehidratarse desde
 * `localStorage` (`chat.draft.<sessionId>`) sin perderse.
 */
describe('ChatPanel — supervivencia del borrador al remontaje (T061, FR-015, SC-006)', () => {
  it('conserva el texto escrito al desmontar y volver a montar el panel', async () => {
    const userEventSetup = userEvent.setup();
    const first = renderPanel();

    await userEventSetup.type(getTextarea(), 'texto a medio escribir');
    expect(getTextarea()).toHaveValue('texto a medio escribir');

    first.unmount();

    renderPanel();

    expect(getTextarea()).toHaveValue('texto a medio escribir');
    expect(window.localStorage.getItem(chatDraftKey(SESSION))).toBe(
      'texto a medio escribir',
    );
  });
});

/**
 * Bandeja de pendientes (T037, US3): `ChatPanel` recibe los ítems del subárbol
 * por props (data-fetching cross-domain en `WorkspacePage`) y responde inline
 * con el `sessionID` de **origen** (FR-005/FR-007). La revalidación (FR-006) y
 * el aviso accesible ante un pendiente ya resuelto los aportan las mutations
 * `useReplyPermission`/`useReplyForm` (T034).
 */

const ORIGIN = 'ses_child';

const permissionRequest = (
  overrides: Partial<PermissionRequest> = {},
): PermissionRequest => ({
  id: 'per_1',
  sessionID: ORIGIN,
  action: 'bash',
  resources: ['rm -rf /tmp/build'],
  message: 'El agente quiere ejecutar un comando',
  ...overrides,
});

const pendingPermission: TChatPendingItem = {
  kind: 'permission',
  originSessionId: ORIGIN,
  originLabel: 'subagent',
  permission: {
    id: 'per_1',
    action: 'bash',
    resources: ['rm -rf /tmp/build'],
    message: 'El agente quiere ejecutar un comando',
  },
};

const pendingQuestionEntry: TQuestionEntry = {
  id: 'form_1',
  title: 'Nombre del proyecto',
  state: 'pending',
  answer: null,
  fields: [{ key: 'name', title: 'Nombre', type: 'string', options: [] }],
};

const pendingQuestion: TChatPendingItem = {
  kind: 'question',
  originSessionId: ORIGIN,
  originLabel: 'subagent',
  question: pendingQuestionEntry,
};

/**
 * Render local de la bandeja con un `QueryClient` de `gcTime` infinito: la
 * revalidación de `useReplyPermission`/`useReplyForm` (FR-006) lee la caché
 * sembrada en el momento de la mutation, así que la clave no puede recolectarse
 * entre el `setQueryData` y el click (el cliente de test global usa `gcTime: 0`).
 * Monta `MemoryRouter` porque el composer incluye Radix `AlertDialog`.
 */
const renderTray = (pending: TChatPendingItem[] = []) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: 0 },
    },
  });
  const tree = (nextPending: TChatPendingItem[]) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChatPanel sessionId={SESSION} pending={nextPending} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(tree(pending));
  return Object.assign(view, {
    queryClient,
    rerenderTray: (nextPending: TChatPendingItem[]) =>
      view.rerender(tree(nextPending)),
  });
};

describe('ChatPanel — bandeja de pendientes (T037, FR-005/FR-006/FR-007)', () => {
  it('compone la bandeja sobre el composer identificando el origen (FR-007)', () => {
    renderTray([pendingPermission, pendingQuestion]);

    expect(screen.getByTestId('chat-pending-tray')).toBeInTheDocument();
    expect(screen.getAllByText('Origen: subagent')).toHaveLength(2);
    expect(screen.getByText('Permiso: bash')).toBeInTheDocument();
    expect(screen.getByText('Nombre del proyecto')).toBeInTheDocument();
    // El composer sigue montado bajo la bandeja.
    expect(getTextarea()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('no monta la bandeja cuando no hay pendientes', () => {
    renderTray();

    expect(screen.queryByTestId('chat-pending-tray')).not.toBeInTheDocument();
  });

  it('responde un permiso con el sessionID de origen (FR-007)', async () => {
    write.replyPermission.mockResolvedValue(undefined);
    const userEventSetup = userEvent.setup();
    const view = renderTray([pendingPermission]);

    act(() => {
      view.queryClient.setQueryData(queryKeys.permissions.list(), [
        permissionRequest(),
      ]);
    });

    await userEventSetup.click(
      screen.getByRole('button', { name: 'Permitir una vez' }),
    );

    await waitFor(() =>
      expect(write.replyPermission).toHaveBeenCalledWith({
        sessionID: ORIGIN,
        requestID: 'per_1',
        decision: 'once',
      }),
    );
  });

  it('responde una pregunta con el sessionID de origen (FR-007)', async () => {
    write.replyForm.mockResolvedValue(undefined);
    const userEventSetup = userEvent.setup();
    const view = renderTray([pendingQuestion]);

    await userEventSetup.type(screen.getByLabelText('Nombre'), 'hola');

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.questions(ORIGIN), [
        pendingQuestionEntry,
      ]);
    });

    await userEventSetup.click(screen.getByRole('button', { name: 'Responder' }));

    await waitFor(() =>
      expect(write.replyForm).toHaveBeenCalledWith({
        sessionID: ORIGIN,
        formID: 'form_1',
        answer: { name: 'hola' },
      }),
    );
  });

  it('no aplica la respuesta de un pendiente ya resuelto y conserva el estado (FR-006/FR-022)', async () => {
    const userEventSetup = userEvent.setup();
    // Sin sembrar `permissions.list()`: la revalidación detecta que ya se resolvió.
    renderTray([pendingPermission]);

    await userEventSetup.click(
      screen.getByRole('button', { name: 'Permitir una vez' }),
    );

    await waitFor(() => expect(write.replyPermission).not.toHaveBeenCalled());
    // El pendiente sigue visible para reintentar (estado conservado).
    expect(screen.getByText('Permiso: bash')).toBeInTheDocument();
  });

  it('lleva el foco al pendiente nuevo que aparece (FR-021)', async () => {
    const view = renderTray();
    expect(
      screen.queryByRole('group', { name: 'Permiso pendiente' }),
    ).not.toBeInTheDocument();

    view.rerenderTray([pendingPermission]);

    expect(
      await screen.findByRole('group', { name: 'Permiso pendiente' }),
    ).toHaveFocus();
  });
});

/**
 * Badge de la pestaña/tab Chat (T053, FR-009; `attention-contract.md §2`): la
 * señal expone una etiqueta textual, una marca **no-color** (icono) y un token de
 * contraste ≥3:1; sin pendientes no renderiza (FR-011).
 */
describe('ChatAttentionBadge — señal de la pestaña Chat (T053, FR-009)', () => {
  it('no renderiza nada sin pendientes (FR-011)', () => {
    const { container } = render(<ChatAttentionBadge count={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('expone una etiqueta textual y una marca no-color (FR-021)', () => {
    render(<ChatAttentionBadge count={3} />);

    const badge = screen.getByRole('img', {
      name: '3 pendientes por atender',
    });
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(badge).toHaveClass('bg-status-waiting', 'text-surface-0');
  });

  it('singulariza la etiqueta con un solo pendiente', () => {
    render(<ChatAttentionBadge count={1} />);

    expect(
      screen.getByRole('img', { name: '1 pendiente por atender' }),
    ).toBeInTheDocument();
  });
});

/**
 * Banner de atención y navegación a la request origen (T055, FR-009/FR-010):
 * `ChatPanel` monta `ChatAttentionBanner` con los pendientes del subárbol y
 * reenvía la acción al manejador que aporta `WorkspacePage`.
 */
const attentionItem: TAttentionItem = {
  id: 'perm_child',
  kind: 'permission',
  sessionId: ORIGIN,
  nodeId: 'node_child',
  title: 'bash',
  at: 1_000,
};

describe('ChatPanel — banner de atención (T055, FR-009/FR-010)', () => {
  it('no monta el banner sin pendientes (FR-011)', () => {
    renderPanel();

    expect(screen.queryByTestId('chat-attention-banner')).not.toBeInTheDocument();
  });

  it('monta el banner y navega a la request origen al accionar (FR-010)', async () => {
    const onGoToRequest = vi.fn();
    const userEventSetup = userEvent.setup();
    renderWithProviders(
      <ChatPanel
        sessionId={SESSION}
        attention={[attentionItem]}
        onGoToRequest={onGoToRequest}
      />,
    );

    expect(screen.getByTestId('chat-attention-banner')).toBeInTheDocument();

    await userEventSetup.click(
      screen.getByRole('button', { name: 'Ir a la solicitud' }),
    );

    expect(onGoToRequest).toHaveBeenCalledTimes(1);
    expect(onGoToRequest).toHaveBeenCalledWith(attentionItem);
  });
});

/**
 * Estados de pantalla del timeline (T056, FR-012; Principio VI): error → carga →
 * vacío → datos. `ChatPanel` no registra la query de mensajes (la siembra el
 * grafo/reducer en la clave compartida `sessions.messages`): observa su estado
 * de caché. El `ChatTimeline` se mantiene montado como anclaje del hilo.
 */
const createStateClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: 0 },
    },
  });

const renderWithClient = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChatPanel sessionId={SESSION} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('ChatPanel — estados de pantalla (T056, FR-012)', () => {
  it('muestra el esqueleto de carga mientras no hay datos', () => {
    renderWithClient(createStateClient());

    expect(screen.getByTestId('chat-loading')).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes todavía')).not.toBeInTheDocument();
    // El timeline sigue montado como anclaje del hilo.
    expect(screen.getByTestId('chat-timeline')).toBeInTheDocument();
  });

  it('muestra el contenido y oculta el esqueleto cuando hay mensajes', () => {
    const queryClient = createStateClient();
    queryClient.setQueryData(queryKeys.sessions.messages(SESSION), [
      msg(user({ id: 'u1', text: 'hola' })),
    ]);

    renderWithClient(queryClient);

    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-loading')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes todavía')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la sesión no tiene mensajes', () => {
    const queryClient = createStateClient();
    queryClient.setQueryData(queryKeys.sessions.messages(SESSION), []);

    renderWithClient(queryClient);

    expect(screen.getByText('Sin mensajes todavía')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-loading')).not.toBeInTheDocument();
  });

  it('muestra el error cuando falla la carga de mensajes', async () => {
    const queryClient = createStateClient();
    await queryClient
      .fetchQuery({
        queryKey: queryKeys.sessions.messages(SESSION),
        queryFn: () => Promise.reject(new Error('fallo de carga')),
      })
      .catch(() => undefined);

    renderWithClient(queryClient);

    expect(
      screen.getByText('No se pudieron cargar los mensajes de la sesión.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('chat-loading')).not.toBeInTheDocument();
  });
});

/**
 * Aviso de canal en vivo (T057, FR-012): al **intentar enviar** con el stream
 * `disconnected`/`reconnecting` se avisa de que la respuesta en vivo puede no
 * llegar, aunque el envío se realice. Con el canal `connected` no hay aviso.
 */
describe('ChatPanel — aviso de canal desconectado (T057, FR-012)', () => {
  it('no avisa si el canal está conectado', async () => {
    connection.state = 'connected';
    write.sendPrompt.mockResolvedValue({ delivery: 'steer' });
    const userEventSetup = userEvent.setup();
    renderPanel();

    await userEventSetup.type(getTextarea(), 'hola');
    await userEventSetup.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(write.sendPrompt).toHaveBeenCalled());
    expect(
      screen.queryByTestId('chat-disconnected-notice'),
    ).not.toBeInTheDocument();
  });

  it('avisa al enviar si el canal está desconectado', async () => {
    connection.state = 'disconnected';
    write.sendPrompt.mockResolvedValue({ delivery: 'steer' });
    const userEventSetup = userEvent.setup();
    renderPanel();

    await userEventSetup.type(getTextarea(), 'hola');
    await userEventSetup.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(
      await screen.findByTestId('chat-disconnected-notice'),
    ).toHaveTextContent('El canal en vivo no está conectado');
    // El envío se realiza igualmente.
    await waitFor(() => expect(write.sendPrompt).toHaveBeenCalled());
  });

  it('avisa también mientras el canal reconecta', async () => {
    connection.state = 'reconnecting';
    write.sendPrompt.mockResolvedValue({ delivery: 'steer' });
    const userEventSetup = userEvent.setup();
    renderPanel();

    await userEventSetup.type(getTextarea(), 'hola');
    await userEventSetup.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(
      await screen.findByTestId('chat-disconnected-notice'),
    ).toBeInTheDocument();
  });
});

/**
 * Catálogo del selector y semilla de la selección activa (T077/T078, FR-008):
 * `ChatPanel` pasa `directory` a `useModelOptions`/`useAgentOptions` (el SDK solo
 * se toca en el service, scopeado por directorio) y `selectionSeed` a
 * `useChatController`, que siembra el agente/modelo vigentes del nodo abierto.
 */
const DIR = '/repo';

const catalogModel = (overrides: Partial<ModelInfo> = {}): ModelInfo =>
  ({
    id: 'gpt-5',
    name: 'GPT-5',
    providerID: 'openai',
    variants: [],
    ...overrides,
  }) as unknown as ModelInfo;

const catalogAgent = (overrides: Partial<AgentInfo> = {}): AgentInfo =>
  ({ id: 'build', name: 'Build', ...overrides }) as unknown as AgentInfo;

describe('ChatPanel — catálogo y semilla de selección (T077/T078, FR-008)', () => {
  beforeEach(() => {
    catalog.listModels.mockReset();
    catalog.listAgents.mockReset();
    catalog.listModels.mockResolvedValue([]);
    catalog.listAgents.mockResolvedValue([]);
  });

  it('con directorio habilita el catálogo scopeado a esa sesión (T077)', async () => {
    renderWithProviders(<ChatPanel sessionId={SESSION} directory={DIR} />);

    await waitFor(() => expect(catalog.listModels).toHaveBeenCalledWith(DIR));
    expect(catalog.listAgents).toHaveBeenCalledWith(DIR);
  });

  it('sin directorio no toca el catálogo (el envío sigue operativo, FR-008)', () => {
    renderPanel();

    expect(catalog.listModels).not.toHaveBeenCalled();
    expect(catalog.listAgents).not.toHaveBeenCalled();
  });

  it('siembra la selección activa con la semilla recibida (T078)', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, staleTime: Infinity, gcTime: Infinity },
        mutations: { retry: 0 },
      },
    });
    // Catálogo en caché para que las opciones estén en el primer render y el
    // `SelectValue` muestre la etiqueta del valor sembrado.
    queryClient.setQueryData(queryKeys.models.list(DIR), [catalogModel()]);
    queryClient.setQueryData(queryKeys.agents.list(DIR), [catalogAgent()]);

    const seed: TChatSelectionSeed = {
      agent: 'build',
      model: { id: 'gpt-5', providerID: 'openai' },
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatPanel sessionId={SESSION} directory={DIR} selectionSeed={seed} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('combobox', { name: 'Agente' })).toHaveTextContent(
      'Build',
    );
    expect(screen.getByRole('combobox', { name: 'Modelo' })).toHaveTextContent(
      'GPT-5',
    );
  });
});
