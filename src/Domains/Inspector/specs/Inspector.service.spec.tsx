import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { FormDetail, FormFields, FormInfo } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { useSessionForms } from '../Inspector.service';

const { listSessionForms, getSessionForm } = vi.hoisted(() => ({
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: { listSessionForms, getSessionForm },
}));

const SESSION_ID = 'ses-1';

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

const formInfo = (overrides: Partial<FormInfo> = {}): FormInfo => ({
  id: 'form-1',
  sessionID: SESSION_ID,
  title: '¿Aplicar el cambio?',
  fields,
  ...overrides,
});

const formDetail = (overrides: Partial<FormDetail> = {}): FormDetail => ({
  id: 'form-1',
  sessionID: SESSION_ID,
  title: '¿Aplicar el cambio?',
  fields,
  state: { status: 'pending' },
  ...overrides,
});

/**
 * Consumidor crudo del grafo: `useGraphModel` cachea los `FormInfo[]` de
 * `session.form.list` bajo `sessions.forms(id)`.
 */
const useRawForms = (id: string) =>
  useQuery({
    queryKey: queryKeys.sessions.forms(id),
    queryFn: () => listSessionForms(id) as Promise<FormInfo[]>,
    staleTime: Infinity,
  });

const renderConsumers = (id: string = SESSION_ID) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    () => ({ raw: useRawForms(id), questions: useSessionForms(id) }),
    { wrapper },
  );
  return { ...rendered, queryClient };
};

describe('useSessionForms query keys (coexistencia con el grafo)', () => {
  beforeEach(() => {
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset();
  });

  it('gives the resolved questions their own key, distinct from the raw forms list', () => {
    expect(queryKeys.sessions.questions(SESSION_ID)).not.toEqual(
      queryKeys.sessions.forms(SESSION_ID),
    );
    // Anidada bajo la clave cruda para heredar su invalidación por prefijo.
    expect(queryKeys.sessions.questions(SESSION_ID)).toEqual([
      ...queryKeys.sessions.forms(SESSION_ID),
      'questions',
    ]);
  });

  it('both consumers receive their own shape and never overwrite each other', async () => {
    const raw = [formInfo()];
    listSessionForms.mockResolvedValue(raw);
    getSessionForm.mockResolvedValue(
      formDetail({ state: { status: 'answered', answer: { choice: 'a' } } }),
    );

    const { result, queryClient } = renderConsumers();

    await waitFor(() => expect(result.current.raw.data).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.questions.questions).toHaveLength(1),
    );

    // El grafo recibe la forma cruda (`FormInfo`), sin `state`/`answer`.
    expect(result.current.raw.data).toEqual(raw);
    expect('state' in (result.current.raw.data?.[0] ?? {})).toBe(false);

    // El Inspector/histórico recibe la forma resuelta (`TQuestionEntry`).
    const question = result.current.questions.questions[0];
    expect(question.state).toBe('answered');
    expect(question.answer).toContain('a');
    expect(question.fields[0].options).toEqual([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);

    // Cada caché conserva su forma: no se pisan.
    expect(queryClient.getQueryData(queryKeys.sessions.forms(SESSION_ID))).toEqual(
      raw,
    );
    expect(
      queryClient.getQueryData(queryKeys.sessions.questions(SESSION_ID)),
    ).toEqual(result.current.questions.questions);
  });

  it('loading the questions first does not clobber the raw forms list', async () => {
    const raw = [formInfo()];
    listSessionForms.mockResolvedValue(raw);
    getSessionForm.mockResolvedValue(formDetail());

    const { result } = renderConsumers();

    await waitFor(() =>
      expect(result.current.questions.questions).toHaveLength(1),
    );
    await waitFor(() => expect(result.current.raw.data).toHaveLength(1));

    // La lista cruda sigue siendo `FormInfo[]` aunque las preguntas ya estén en
    // caché (antes, con la clave compartida, ganaba quien cargase primero).
    expect(result.current.raw.data).toEqual(raw);
    expect('state' in (result.current.raw.data?.[0] ?? {})).toBe(false);
  });

  it('refreshes the resolved questions when the raw forms key is invalidated', async () => {
    listSessionForms.mockResolvedValue([formInfo()]);
    getSessionForm.mockResolvedValueOnce(formDetail());

    const { result, queryClient } = renderConsumers();

    await waitFor(() =>
      expect(result.current.questions.questions[0]?.state).toBe('pending'),
    );

    getSessionForm.mockResolvedValue(
      formDetail({ state: { status: 'answered', answer: { choice: 'a' } } }),
    );
    // Los eventos `form.*` invalidan `sessions.forms(id)`; la clave de preguntas
    // cuelga de ella, así que se refresca por coincidencia de prefijo.
    await queryClient.invalidateQueries({
      queryKey: queryKeys.sessions.forms(SESSION_ID),
    });

    await waitFor(() =>
      expect(result.current.questions.questions[0]?.state).toBe('answered'),
    );
  });
});
