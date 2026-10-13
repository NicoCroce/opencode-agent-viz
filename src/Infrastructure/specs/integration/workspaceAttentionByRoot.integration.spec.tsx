import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Project } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { formDetail, formInfo, permissionRequest } from '@app/Infrastructure/lib/specs/fixtures';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedForms,
  seedMessages,
  seedPermissions,
  seedQueryData,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * T018 [US1] — E2E de frontera U1↔U2↔U5: atención por **raíz** del rail.
 *
 * Recorre de punta a punta la cadena `countAttentionByRoot` → `useAttentionByRoot`
 * → `SessionsRail.attentionByRoot` → `SessionList` montando `WorkspacePage` con el
 * modelo real: la raíz abierta suma los permisos de **su subárbol** más las
 * preguntas; el resto de raíces solo cuentan su propia sesión. El rail real
 * reenvía el `Record<string, number>` y el marcador de `SessionList` del arnés lo
 * expone en `data-attention`.
 *
 * Caso negativo obligatorio: raíz sin permisos ⇒ `0`; raíz ausente de `counts`
 * (se abre una hija) ⇒ sin entrada; sin raíz abierta (`openRootId === null`) ⇒
 * no se suman preguntas, solo los permisos propios de cada raíz.
 */

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock } = await import('./harness');
  return { opencodeService: serviceMock };
});
vi.mock('@app/Domains/Graph', async () => {
  const { mockGraphBarrel } = await import('./harness');
  return mockGraphBarrel();
});
vi.mock('@app/Domains/Sessions', async () => {
  const { mockSessionsBarrel } = await import('./harness');
  return mockSessionsBarrel();
});
vi.mock('@app/Domains/Chat', async () => {
  const { mockChatBarrel } = await import('./harness');
  return mockChatBarrel();
});
vi.mock('@app/Domains/Inspector', async () => {
  const { mockInspectorBarrel } = await import('./harness');
  return mockInspectorBarrel();
});
vi.mock('@app/Domains/History', async () => {
  const { mockHistoryBarrel } = await import('./harness');
  return mockHistoryBarrel();
});

const ROOT_ID = INTEGRATION_SESSION_ID; // 'ses_root' — raíz abierta
const CHILD_ID = INTEGRATION_CHILD_SESSION_ID; // 'ses_child' — subagente del subárbol
const OTHER_ROOT_ID = 'ses_other'; // otra raíz con un permiso propio
const QUIET_ROOT_ID = 'ses_quiet'; // raíz sin pendientes

const FORM_ID = 'form_attention';

const rootSession = () => buildSessionInfo();
const childSession = () =>
  buildSessionInfo({ id: CHILD_ID, parentID: ROOT_ID });
const otherRootSession = () => buildSessionInfo({ id: OTHER_ROOT_ID });
const quietRootSession = () => buildSessionInfo({ id: QUIET_ROOT_ID });

const project = (canonical: string): Project => ({
  id: canonical,
  canonical,
  time: { created: 1, updated: 1, active: 1 },
  sandboxes: [],
});

/**
 * Siembra el escenario completo: proyectos (dirigen `sessions.roots`), las tres
 * raíces del rail, el subárbol de la raíz abierta (raíz + hija), los mensajes
 * cacheados (para que el enriquecimiento marque los nodos `ready` sin red), el
 * formulario **pendiente** de la hija (⇒ nodo `waiting-input` ⇒ pregunta) y la
 * lista global de permisos. La raíz silenciosa no recibe ningún permiso.
 */
const seedAttentionScenario = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.projects.list(), [project(INTEGRATION_DIRECTORY)]);
  seedSessions(client, [rootSession(), otherRootSession(), quietRootSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedMessages(client, { [ROOT_ID]: [], [CHILD_ID]: [] });
  seedForms(client, {
    bySession: { [CHILD_ID]: [formInfo({ id: FORM_ID, sessionID: CHILD_ID })] },
    details: {
      [CHILD_ID]: [formDetail({ id: FORM_ID, sessionID: CHILD_ID })],
    },
  });
  seedPermissions(client, [
    permissionRequest({ id: 'perm_root', sessionID: ROOT_ID }),
    permissionRequest({ id: 'perm_child', sessionID: CHILD_ID }),
    permissionRequest({ id: 'perm_other', sessionID: OTHER_ROOT_ID }),
  ]);
  seedDevice(client, false);
};

/** `data-attention` del marcador de `SessionList` como objeto. */
const readAttention = async (): Promise<Record<string, number>> => {
  const rail = await screen.findByTestId(TESTID.sessionList);
  let parsed: Record<string, number> = {};
  await waitFor(() => {
    parsed = JSON.parse(rail.getAttribute('data-attention') ?? '{}') as Record<
      string,
      number
    >;
    expect(parsed).toHaveProperty(ROOT_ID);
  });
  return parsed;
};

/**
 * Monta `WorkspacePage` en una ruta **sin** `:id` (catch-all) para ejercer
 * `openRootId === null`: el arnés solo expone la ruta `/sessions/:id`, así que
 * aquí se compone el mismo `QueryClientProvider`/`MemoryRouter` con el cliente de
 * integración y los mocks del arnés.
 */
const renderWorkspaceWithoutSession = async (
  client: QueryClient,
): Promise<RenderResult> => {
  const { WorkspacePage } = await import('../../WorkspacePage');

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  resetServiceMock();
});

describe('atención por raíz del rail (U1↔U2↔U5, T018)', () => {
  it('la raíz abierta suma subárbol + preguntas; otra raíz solo su sesión; sin permisos cuenta 0', async () => {
    const client = createIntegrationQueryClient();
    seedAttentionScenario(client);

    await renderWorkspace(client);

    expect(await readAttention()).toEqual({
      [ROOT_ID]: 3, // perm_root + perm_child + 1 pregunta del subárbol
      [OTHER_ROOT_ID]: 1, // solo perm_other (no es la raíz abierta)
      [QUIET_ROOT_ID]: 0, // sin permisos ni preguntas
    });
  });

  it('una raíz ausente de `counts` (se abre una hija) no recibe badge ni suma preguntas a otras raíces', async () => {
    const client = createIntegrationQueryClient();
    seedAttentionScenario(client);
    // El subárbol cargado es el de la hija abierta; la raíz no es la raíz abierta.
    seedSubtree(client, [childSession()], { sessionId: CHILD_ID });

    await renderWorkspace(client, { sessionId: CHILD_ID });

    const attention = await readAttention();
    expect(attention).toEqual({ [ROOT_ID]: 1, [OTHER_ROOT_ID]: 1, [QUIET_ROOT_ID]: 0 });
    // `ses_child` no está en el listado de raíces ⇒ no tiene entrada.
    expect(attention).not.toHaveProperty(CHILD_ID);
  });

  it('sin raíz abierta (`openRootId === null`) no suma preguntas: cada raíz cuenta solo su sesión', async () => {
    const client = createIntegrationQueryClient();
    seedAttentionScenario(client);

    await renderWorkspaceWithoutSession(client);

    expect(await readAttention()).toEqual({
      [ROOT_ID]: 1, // solo perm_root (ni subárbol ni preguntas)
      [OTHER_ROOT_ID]: 1,
      [QUIET_ROOT_ID]: 0,
    });
  });
});
