import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  FileDiffInfo,
  FormDetail,
  FormFields,
  PermissionRequest,
  SessionInboxInfo,
  SessionMessageInfo,
} from '@opencode/client';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { useInspectorData } from '../useInspectorData';

const {
  getSessionMessages,
  getMcpServers,
  getSessionInstructions,
  getSessionDiff,
  listSessionForms,
  getSessionForm,
  getSessionPermissions,
  listSessionInbox,
  getSessionContext,
} = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  getMcpServers: vi.fn(),
  getSessionInstructions: vi.fn(),
  getSessionDiff: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  getSessionPermissions: vi.fn(),
  listSessionInbox: vi.fn(),
  getSessionContext: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    getSessionMessages,
    getMcpServers,
    getSessionInstructions,
    getSessionDiff,
    listSessionForms,
    getSessionForm,
    getSessionPermissions,
    listSessionInbox,
    getSessionContext,
  },
}));

const SESSION_ID = 'ses-1';

const node: TGraphNode = {
  id: 'root',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: SESSION_ID,
    title: 'Tarea raíz',
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo/opencode-agent-viz',
    model: { providerID: 'opencode', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 3000,
      startedAt: 0,
      endedAt: 3000,
      cost: 0.02,
      tokens: null,
      invocations: 2,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
};

const change = (overrides: Partial<FileDiffInfo>): FileDiffInfo => ({
  file: 'src/index.ts',
  patch: '@@ -1 +1 @@',
  additions: 1,
  deletions: 0,
  status: 'modified',
  ...overrides,
});

/** Wrapper estable por test: el mismo QueryClient sobrevive a los rerenders. */
const renderInspectorData = (selected: TGraphNode | null = node) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useInspectorData(selected), { wrapper });
};

describe('useInspectorData (diff)', () => {
  beforeEach(() => {
    getSessionMessages.mockReset().mockResolvedValue([]);
    getMcpServers.mockReset().mockResolvedValue([]);
    getSessionInstructions.mockReset().mockResolvedValue([]);
    getSessionDiff.mockReset().mockResolvedValue([]);
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset();
    getSessionPermissions.mockReset().mockResolvedValue([]);
    listSessionInbox.mockReset().mockResolvedValue([]);
    getSessionContext.mockReset().mockResolvedValue([]);
  });

  it('exposes the files affected by the agent', async () => {
    const changes = [
      change({ file: 'src/a.ts', status: 'added', additions: 10, deletions: 0 }),
      change({
        file: 'src/b.ts',
        status: 'deleted',
        additions: 0,
        deletions: 4,
      }),
    ];
    getSessionDiff.mockResolvedValue(changes);

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.diff.changes).toHaveLength(2));
    expect(result.current.diff.changes).toEqual(changes);
    expect(result.current.diff.isError).toBe(false);
    expect(result.current.diff.isLoading).toBe(false);
    expect(getSessionDiff).toHaveBeenCalledWith(SESSION_ID);
  });

  it('reports an empty diff without an error', async () => {
    getSessionDiff.mockResolvedValue([]);

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.diff.isLoading).toBe(false));
    expect(result.current.diff.changes).toEqual([]);
    expect(result.current.diff.isError).toBe(false);
  });

  it('flags a failed diff query while keeping the changes empty', async () => {
    getSessionDiff.mockRejectedValue(new Error('diff failed'));

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.diff.isError).toBe(true));
    expect(result.current.diff.changes).toEqual([]);
    expect(result.current.diff.isLoading).toBe(false);
  });

  it('stays idle without a session and does not read the diff', () => {
    const { result } = renderInspectorData(null);

    expect(result.current.diff).toEqual({
      changes: [],
      isError: false,
      isLoading: false,
    });
    expect(getSessionDiff).not.toHaveBeenCalled();
  });
});

const formDetail = (overrides: Partial<FormDetail> = {}): FormDetail => ({
  id: 'form-1',
  sessionID: SESSION_ID,
  title: '¿Aplicar el cambio?',
  fields: [{ key: 'confirm', title: 'Confirmar', type: 'boolean' }],
  state: { status: 'pending' },
  ...overrides,
});

const permission = (
  overrides: Partial<PermissionRequest> = {},
): PermissionRequest => ({
  id: 'perm-1',
  sessionID: SESSION_ID,
  action: 'bash',
  resources: ['rm -rf build'],
  message: 'Permiso requerido',
  ...overrides,
});

const inboxItem = (
  delivery: SessionInboxInfo['delivery'],
  id = 'inbox-1',
): SessionInboxInfo => ({
  id,
  sessionID: SESSION_ID,
  time: { created: 0 },
  type: 'user',
  payload: { text: 'hola' },
  delivery,
});

describe('useInspectorData (forms/permissions/inbox)', () => {
  beforeEach(() => {
    getSessionMessages.mockReset().mockResolvedValue([]);
    getMcpServers.mockReset().mockResolvedValue([]);
    getSessionInstructions.mockReset().mockResolvedValue([]);
    getSessionDiff.mockReset().mockResolvedValue([]);
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset();
    getSessionPermissions.mockReset().mockResolvedValue([]);
    listSessionInbox.mockReset().mockResolvedValue([]);
    getSessionContext.mockReset().mockResolvedValue([]);
  });

  it('resolves each form state and never answers pending/cancelled', async () => {
    listSessionForms.mockResolvedValue([
      { id: 'f-pending', sessionID: SESSION_ID, title: 'Pendiente', fields: [] },
      {
        id: 'f-answered',
        sessionID: SESSION_ID,
        title: 'Respondida',
        fields: [],
      },
      {
        id: 'f-cancelled',
        sessionID: SESSION_ID,
        title: 'Cancelada',
        fields: [],
      },
    ]);
    getSessionForm.mockImplementation((_id: string, formID: string) => {
      if (formID === 'f-answered') {
        return Promise.resolve(
          formDetail({
            id: 'f-answered',
            title: 'Respondida',
            state: { status: 'answered', answer: { choice: 'a' } },
          }),
        );
      }
      if (formID === 'f-cancelled') {
        return Promise.resolve(
          formDetail({
            id: 'f-cancelled',
            title: 'Cancelada',
            state: { status: 'cancelled', message: 'descartada' },
          }),
        );
      }
      return Promise.resolve(
        formDetail({ id: 'f-pending', title: 'Pendiente' }),
      );
    });

    const { result } = renderInspectorData();

    await waitFor(() =>
      expect(result.current.forms.questions).toHaveLength(3),
    );

    const byId = Object.fromEntries(
      result.current.forms.questions.map((question) => [question.id, question]),
    );

    expect(byId['f-pending'].state).toBe('pending');
    expect(byId['f-pending'].answer).toBeNull();
    expect(byId['f-answered'].state).toBe('answered');
    expect(byId['f-answered'].answer).toContain('a');
    expect(byId['f-cancelled'].state).toBe('cancelled');
    expect(byId['f-cancelled'].answer).toBeNull();
    expect(result.current.forms.isError).toBe(false);
    expect(getSessionForm).toHaveBeenCalledWith(SESSION_ID, 'f-answered');
  });

  it('exposes the question fields with their options', async () => {
    const fields: FormFields = [
      {
        key: 'choice',
        title: 'Opción',
        type: 'multiselect',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    ];
    listSessionForms.mockResolvedValue([
      { id: 'f1', sessionID: SESSION_ID, title: 'Elige', fields },
    ]);
    getSessionForm.mockResolvedValue(
      formDetail({ id: 'f1', title: 'Elige', fields }),
    );

    const { result } = renderInspectorData();

    await waitFor(() =>
      expect(result.current.forms.questions).toHaveLength(1),
    );
    expect(result.current.forms.questions[0].fields[0]).toEqual({
      key: 'choice',
      title: 'Opción',
      type: 'multiselect',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
  });

  it('incorporates the questions into the history entries (FR-033)', async () => {
    listSessionForms.mockResolvedValue([
      { id: 'f1', sessionID: SESSION_ID, title: 'Elige', fields: [] },
    ]);
    getSessionForm.mockResolvedValue(formDetail({ id: 'f1', title: 'Elige' }));

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]).toMatchObject({
      kind: 'question',
      formId: 'f1',
      title: 'Elige',
    });
  });

  it('exposes the permissions the session is waiting for', async () => {
    getSessionPermissions.mockResolvedValue([permission()]);

    const { result } = renderInspectorData();

    await waitFor(() =>
      expect(result.current.permissions.permissions).toHaveLength(1),
    );
    expect(result.current.permissions.permissions[0]).toEqual({
      id: 'perm-1',
      action: 'bash',
      resources: ['rm -rf build'],
      message: 'Permiso requerido',
    });
    expect(result.current.permissions.isError).toBe(false);
  });

  it('counts only the queued inbox items as pending turns', async () => {
    listSessionInbox.mockResolvedValue([
      inboxItem('queue', 'i1'),
      inboxItem('steer', 'i2'),
      inboxItem('queue', 'i3'),
    ]);

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.inbox.items).toHaveLength(3));
    expect(result.current.inbox.queuedTurns).toBe(2);
    expect(result.current.inbox.isError).toBe(false);
  });

  it('flags a failed forms query while keeping the questions empty', async () => {
    listSessionForms.mockRejectedValue(new Error('forms failed'));

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.forms.isError).toBe(true));
    expect(result.current.forms.questions).toEqual([]);
    expect(result.current.forms.isLoading).toBe(false);
  });

  it('stays idle without a session and does not read forms/permissions/inbox', () => {
    const { result } = renderInspectorData(null);

    expect(result.current.forms).toEqual({
      questions: [],
      isError: false,
      isLoading: false,
    });
    expect(result.current.permissions).toEqual({
      permissions: [],
      isError: false,
      isLoading: false,
    });
    expect(result.current.inbox).toEqual({
      queuedTurns: 0,
      items: [],
      isError: false,
      isLoading: false,
    });
    expect(listSessionForms).not.toHaveBeenCalled();
    expect(getSessionPermissions).not.toHaveBeenCalled();
    expect(listSessionInbox).not.toHaveBeenCalled();
  });
});

describe('useInspectorData (context)', () => {
  beforeEach(() => {
    getSessionMessages.mockReset().mockResolvedValue([]);
    getMcpServers.mockReset().mockResolvedValue([]);
    getSessionInstructions.mockReset().mockResolvedValue([]);
    getSessionDiff.mockReset().mockResolvedValue([]);
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset();
    getSessionPermissions.mockReset().mockResolvedValue([]);
    listSessionInbox.mockReset().mockResolvedValue([]);
    getSessionContext.mockReset().mockResolvedValue([]);
  });

  it('exposes the resulting context of a compaction', async () => {
    const messages: SessionMessageInfo[] = [
      { id: 'm1', time: { created: 1 }, type: 'user', text: 'hola' },
    ];
    getSessionContext.mockResolvedValue(messages);

    const { result } = renderInspectorData();

    await waitFor(() =>
      expect(result.current.context.messages).toHaveLength(1),
    );
    expect(result.current.context.messages).toEqual(messages);
    expect(result.current.context.isError).toBe(false);
    expect(result.current.context.isLoading).toBe(false);
    expect(getSessionContext).toHaveBeenCalledWith(SESSION_ID);
  });

  it('reports an empty context without an error', async () => {
    getSessionContext.mockResolvedValue([]);

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.context.isLoading).toBe(false));
    expect(result.current.context.messages).toEqual([]);
    expect(result.current.context.isError).toBe(false);
  });

  it('flags a failed context query while keeping the messages empty', async () => {
    getSessionContext.mockRejectedValue(new Error('context failed'));

    const { result } = renderInspectorData();

    await waitFor(() => expect(result.current.context.isError).toBe(true));
    expect(result.current.context.messages).toEqual([]);
    expect(result.current.context.isLoading).toBe(false);
  });

  it('stays idle without a session and does not read the context', () => {
    const { result } = renderInspectorData(null);

    expect(result.current.context).toEqual({
      messages: [],
      isError: false,
      isLoading: false,
    });
    expect(getSessionContext).not.toHaveBeenCalled();
  });
});
