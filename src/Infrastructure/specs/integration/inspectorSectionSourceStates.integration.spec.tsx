/**
 * Huecos de frontera **U6↔U4** en los estados de cada fuente de sección
 * (`contracts/inspector-section-tabs-contract.md` §5, Principio VI / SC-005):
 * las ramas de **carga** y de **fallo de una sola fuente** que las suites
 * vecinas no cubrían.
 *
 * Monta el `InspectorPanel` **real** (no el marcador) con
 * `renderWithProviders` + `createIntegrationQueryClient` y el SDK doblado por el
 * arnés (`serviceMock`/`resetServiceMock`), sin sembrar la caché: cada caso deja
 * **una sola** fuente en el estado que quiere ejercer y las demás resueltas en
 * vacío, de modo que la aserción atribuye el estado a esa fuente concreta.
 *
 * - §5 «Archivos»: `sessions.diff` **pendiente** ⇒ carga (`Skeleton`) y **nunca**
 *   el vacío ("Sin cambios de archivos"). T031 cubría el 404 y el vacío/datos.
 * - §5 «Preguntas y permisos»: el error/carga de la sección es el **OR** de tres
 *   fuentes (`questions` + `permissions.for` + `sessions.inbox`). T031 solo
 *   ejercía el 404 de `questions`. Aquí: `permissions.for` en 404 con las otras
 *   dos resueltas ⇒ error; `sessions.inbox` en 404 ⇒ error; `questions`
 *   **pendiente** con las otras dos resueltas ⇒ carga. Nunca el vacío.
 * - §5 «Latencia»: los mensajes del padre (`invokedBy`) **pendientes** ⇒ carga
 *   (`Skeleton`) y **nunca** el vacío ("Sin respuestas medidas"). T015 cubría el
 *   404 (error).
 *
 * En los cinco casos el tablist de siete pestañas sigue montado y operativo: el
 * estado de una fuente no rompe el panel ni deja la sección vacía.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { INSPECTOR_SECTION_TABS_ARIA_LABEL } from '@app/Domains/Inspector';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

const SESSION_ID = 'ses_source_states';
const PARENT_SESSION_ID = 'ses_source_states_parent';

/** Copy literal del contrato §5 (estados y etiquetas, sin renombrar). */
const FILES_TAB = 'Archivos';
const QUESTIONS_TAB = 'Preguntas y permisos';
const LATENCY_TAB = 'Latencia';
const ERROR_TEXT = 'Ocurrió un error al cargar los datos';
const FILES_EMPTY = 'Sin cambios de archivos';
const QUESTIONS_EMPTY = 'Sin permisos ni preguntas';
const LATENCY_EMPTY = 'Sin respuestas medidas';

/** `data-testid` congelado de la sección de latencia (contrato §5). */
const LATENCY_SECTION_TEST_ID = 'latency-section';

/** Nodo mínimo del grafo, con la identidad que consume el panel. */
const buildNode = (sessionId: string): TGraphNode => ({
  id: sessionId,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId,
    title: `Tarea ${sessionId}`,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: { providerID: 'opencode-go', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 0,
      startedAt: 0,
      endedAt: 0,
      cost: 0,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
});

/** Promesa que nunca resuelve: deja la fuente en carga indefinidamente. */
const neverResolves = (): Promise<never> => new Promise(() => {});

const renderPanel = (
  sessionId: string,
  options: { invokedBy?: TGraphNode } = {},
) =>
  renderWithProviders(
    <InspectorPanel node={buildNode(sessionId)} invokedBy={options.invokedBy} />,
    { queryClient: createIntegrationQueryClient() },
  );

const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

/** Panel activo; los otros seis quedan `hidden` y Radix no monta sus hijos. */
const getActivePanel = (): HTMLElement => screen.getByRole('tabpanel');

/** Abre una pestaña por su etiqueta literal y espera la activación. */
const openTab = async (
  user: ReturnType<typeof setupRadixUser>,
  name: string,
): Promise<HTMLElement> => {
  await user.click(within(getTablist()).getByRole('tab', { name }));

  await waitFor(() =>
    expect(within(getTablist()).getByRole('tab', { name })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );

  return getActivePanel();
};

/** El tablist interno sigue íntegro: siete pestañas y una sola activa. */
const expectSingleActiveTablist = (): void => {
  const tabs = within(getTablist()).getAllByRole('tab');
  expect(tabs).toHaveLength(7);
  expect(
    tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true'),
  ).toHaveLength(1);
};

/** Estado de carga de una sección: `Skeleton`/`ListSkeleton` (`animate-pulse`). */
const expectLoading = (section: HTMLElement): void => {
  expect(section.querySelector('.animate-pulse')).not.toBeNull();
};

beforeEach(() => {
  resetServiceMock(serviceMock);
  // `resetServiceMock` deja el diff sin valor de retorno: se fija el vacío por
  // defecto (el caso de carga lo sustituye por una promesa que nunca resuelve).
  serviceMock.getSessionDiff.mockResolvedValue([]);
});

describe('InspectorPanel — estados por fuente de cada sección (§5, U6↔U4)', () => {
  it('Archivos: el diff pendiente muestra carga y nunca el vacío ni el error', async () => {
    const user = setupRadixUser();
    serviceMock.getSessionDiff.mockReturnValue(neverResolves());

    renderPanel(SESSION_ID);

    const panel = await openTab(user, FILES_TAB);

    const files = within(panel).getByText(FILES_TAB);
    expect(files).toBeInTheDocument();
    expectLoading(panel);
    expect(within(panel).queryByText(FILES_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    expect(serviceMock.getSessionDiff).toHaveBeenCalledWith(SESSION_ID);
    expectSingleActiveTablist();
  });

  it('Preguntas y permisos: solo los permisos en 404 muestran error (OR de tres fuentes) y nunca el vacío', async () => {
    const user = setupRadixUser();
    serviceMock.getSessionPermissions.mockRejectedValue(
      new Error('404: permisos no encontrados'),
    );

    renderPanel(SESSION_ID);

    const panel = await openTab(user, QUESTIONS_TAB);

    await within(panel).findByText(ERROR_TEXT);
    expect(within(panel).queryByText(QUESTIONS_EMPTY)).not.toBeInTheDocument();
    // Las otras dos fuentes resolvieron sin error: el error es de los permisos.
    expect(serviceMock.getSessionPermissions).toHaveBeenCalledWith(SESSION_ID);
    expect(serviceMock.listSessionForms).toHaveBeenCalledWith(SESSION_ID);
    expect(serviceMock.listSessionInbox).toHaveBeenCalledWith(SESSION_ID);

    expectSingleActiveTablist();
  });

  it('Preguntas y permisos: solo la cola en 404 muestra error (OR de tres fuentes) y nunca el vacío', async () => {
    const user = setupRadixUser();
    serviceMock.listSessionInbox.mockRejectedValue(
      new Error('404: bandeja no encontrada'),
    );

    renderPanel(SESSION_ID);

    const panel = await openTab(user, QUESTIONS_TAB);

    await within(panel).findByText(ERROR_TEXT);
    expect(within(panel).queryByText(QUESTIONS_EMPTY)).not.toBeInTheDocument();
    expect(serviceMock.listSessionInbox).toHaveBeenCalledWith(SESSION_ID);
    // Las fuentes resueltas no aportan filas: el error manda sobre el vacío.
    expect(within(panel).queryByText('Turnos en cola: 0')).not.toBeInTheDocument();

    expectSingleActiveTablist();
  });

  it('Preguntas y permisos: solo las preguntas en carga muestran el esqueleto y nunca el vacío', async () => {
    const user = setupRadixUser();
    serviceMock.listSessionForms.mockReturnValue(neverResolves());

    renderPanel(SESSION_ID);

    const panel = await openTab(user, QUESTIONS_TAB);

    expect(within(panel).getByText(QUESTIONS_TAB)).toBeInTheDocument();
    expectLoading(panel);
    expect(within(panel).queryByText(QUESTIONS_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    expectSingleActiveTablist();
  });

  it('Latencia: los mensajes del padre pendientes muestran carga y nunca el vacío ni el error', async () => {
    const user = setupRadixUser();
    const parent = buildNode(PARENT_SESSION_ID);
    serviceMock.getSessionMessages.mockReturnValue(neverResolves());

    renderPanel(SESSION_ID, { invokedBy: parent });

    const panel = await openTab(user, LATENCY_TAB);
    const latency = screen.getByTestId(LATENCY_SECTION_TEST_ID);
    expect(panel).toContainElement(latency);

    // `useContextMetrics` toma el estado de los mensajes del padre: pendiente ⇒
    // carga (error → carga → vacío → datos), nunca el vacío legítimo.
    expect(within(latency).getByText(LATENCY_TAB)).toBeInTheDocument();
    expectLoading(latency);
    expect(within(latency).queryByText(LATENCY_EMPTY)).not.toBeInTheDocument();
    expect(within(latency).queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    expectSingleActiveTablist();
  });
});
