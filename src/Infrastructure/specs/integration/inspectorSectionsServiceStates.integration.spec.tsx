/**
 * U22 (T031) — E2E de frontera **U6↔U4** (`contracts/inspector-section-tabs-contract.md`
 * §5): cadena `sessions.diff` / `sessions.questions` + `permissions.for` +
 * `sessions.inbox` → secciones **Archivos** y **Preguntas y permisos**.
 *
 * Monta el `InspectorPanel` **real** (no el marcador del arnés) con
 * `renderWithProviders` + `createIntegrationQueryClient` y el SDK sustituido por
 * el doble del arnés (`serviceMock`/`resetServiceMock`), sembrando la caché con
 * las **mismas claves** que escribe `loadNodeContent` y leen los hooks reales
 * (`seedQueryData`/`seedForms`/`seedPermissions`):
 *
 * - `sessions.diff(id)` → `FileChanges.changes` (FR-028..FR-030);
 * - `sessions.questions(id)` (preguntas resueltas) → `QuestionsSection`;
 * - `permissions.for(id)` → `QuestionsSection`;
 * - `sessions.inbox(id)` → `QuestionsSection.queuedTurns` (solo `delivery === 'queue'`).
 *
 * 1. **Camino feliz**: Archivos muestra los cambios sembrados (con su parche al
 *    seleccionar) y Preguntas y permisos las **tres** fuentes (permisos,
 *    preguntas y cola), sin estado vacío ni de error ni una sola llamada a la
 *    red (`staleTime: Infinity` del arnés ⇒ la caché sembrada es la fuente).
 * 2. **Caso negativo (dato inexistente / 404)**: `serviceMock.getSessionDiff` y
 *    `listSessionForms` rechazan ⇒ error visible en **ambas** secciones y
 *    **nunca** el vacío (SC-005: el vacío no puede afirmarse mientras la fuente
 *    falla), con el resto del panel intacto (identidad, resumen continuo,
 *    tablist de siete pestañas y el resto de secciones operativas).
 *
 * Cada sección resuelve **error → carga → vacío → datos** (Principio VI) y
 * Radix solo monta el contenido de la pestaña activa, así que cada sección se
 * ejerce abriendo su pestaña.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type {
  FileDiffInfo,
  PermissionRequest,
  SessionInboxInfo,
} from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '@app/Domains/queryKeys';
import { INSPECTOR_SECTION_TABS_ARIA_LABEL } from '@app/Domains/Inspector';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedForms,
  seedPermissions,
  seedQueryData,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

const SESSION_ID = 'ses_u22';
const NODE_TITLE = 'Impacto en el repositorio';

/** Copy del contrato §5 (literal, sin renombrar): etiquetas y estados. */
const FILES_TAB = 'Archivos';
const QUESTIONS_TAB = 'Preguntas y permisos';
const ERRORS_TAB = 'Errores';
const ERROR_TEXT = 'Ocurrió un error al cargar los datos';
const FILES_EMPTY = 'Sin cambios de archivos';
const QUESTIONS_EMPTY = 'Sin permisos ni preguntas';

const MODIFIED_FILE = 'src/Domains/Inspector/Components/FileChanges.tsx';
const ADDED_FILE = 'src/Domains/Inspector/NEW.spec.ts';

/** Nodo mínimo del grafo, con la identidad que consume el panel. */
const buildNode = (): TGraphNode => ({
  id: SESSION_ID,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: SESSION_ID,
    title: NODE_TITLE,
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

/** Impacto en el repositorio (`sessions.diff`): un modificado con parche y un añadido sin él. */
const fileChanges: FileDiffInfo[] = [
  {
    file: MODIFIED_FILE,
    status: 'modified',
    additions: 12,
    deletions: 3,
    patch: '@@ -1,2 +1,3 @@\n contexto\n-removida\n+anadida\n',
  },
  {
    file: ADDED_FILE,
    status: 'added',
    additions: 5,
    deletions: 0,
    patch: '',
  },
];

/** Preguntas resueltas (`sessions.questions`): una respondida y una pendiente. */
const questions: TQuestionEntry[] = [
  {
    id: 'frm_scope',
    title: '¿Qué alcance tiene el cambio?',
    fields: [{ key: 'scope', title: 'Alcance', type: 'string', options: [] }],
    state: 'answered',
    answer: 'scope: mínimo',
  },
  {
    id: 'frm_rewrite',
    title: '¿Reescribo el histórico?',
    fields: [{ key: 'rewrite', title: null, type: 'boolean', options: [] }],
    state: 'pending',
    answer: null,
  },
];

/** Permisos esperados (`permissions.for`), en su forma cruda del SDK. */
const permissions: PermissionRequest[] = [
  {
    id: 'perm_bash',
    sessionID: SESSION_ID,
    action: 'bash',
    resources: ['rm -rf dist'],
    message: 'Requiere confirmación',
  },
];

/** Cola de turnos (`sessions.inbox`): solo el `queue` cuenta como turno pendiente. */
const inboxItems: SessionInboxInfo[] = [
  {
    id: 'inbox_queue',
    sessionID: SESSION_ID,
    time: { created: 1 },
    type: 'user',
    payload: { text: 'sigue con los tests' },
    delivery: 'queue',
  },
  {
    id: 'inbox_steer',
    sessionID: SESSION_ID,
    time: { created: 2 },
    type: 'user',
    payload: { text: 'ahora' },
    delivery: 'steer',
  },
];

/** Siembra las cuatro claves de la frontera antes del render. */
const seedSections = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.sessions.diff(SESSION_ID), fileChanges);
  seedForms(client, { questions: { [SESSION_ID]: questions } });
  seedPermissions(client, [], { bySession: { [SESSION_ID]: permissions } });
  seedQueryData(client, queryKeys.sessions.inbox(SESSION_ID), inboxItems);
};

const renderPanel = (
  client: QueryClient,
  seed?: (queryClient: QueryClient) => void,
) =>
  renderWithProviders(<InspectorPanel node={buildNode()} />, {
    queryClient: client,
    seed,
  });

const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

/** Panel activo (los otros seis quedan `hidden` y Radix no monta sus hijos). */
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

beforeEach(() => {
  resetServiceMock(serviceMock);
});

describe('InspectorPanel — estados de servicio de Archivos y Preguntas y permisos (§5)', () => {
  it('Archivos muestra los cambios y Preguntas y permisos las tres fuentes, sin red', async () => {
    const user = setupRadixUser();
    renderPanel(createIntegrationQueryClient(), seedSections);

    // --- Archivos (`sessions.diff`) ---
    let panel = await openTab(user, FILES_TAB);
    expect(within(panel).getByText(FILES_TAB)).toBeInTheDocument();
    expect(within(panel).getByText(MODIFIED_FILE)).toBeInTheDocument();
    expect(within(panel).getByText('modificado')).toBeInTheDocument();
    expect(within(panel).getByText('+12')).toBeInTheDocument();
    expect(within(panel).getByText('-3')).toBeInTheDocument();
    expect(within(panel).getByText(ADDED_FILE)).toBeInTheDocument();
    expect(within(panel).getByText('añadido')).toBeInTheDocument();
    expect(within(panel).queryByText(FILES_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    // Seleccionar el archivo modificado muestra su parche (FR-016..FR-018); el
    // añadido sin parche no rompe la vista.
    await user.click(
      within(panel).getByRole('button', { name: /FileChanges/ }),
    );
    expect(within(panel).getByText('anadida')).toBeInTheDocument();
    expect(within(panel).getByText('removida')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /NEW\.spec/ }));
    expect(within(panel).getByText('parche no disponible')).toBeInTheDocument();

    // --- Preguntas y permisos (`questions` + `permissions.for` + `inbox`) ---
    panel = await openTab(user, QUESTIONS_TAB);
    expect(within(panel).getByText(QUESTIONS_TAB)).toBeInTheDocument();

    // Permisos: `action` + `resources[]` + motivo.
    expect(within(panel).getByText('Permisos')).toBeInTheDocument();
    expect(within(panel).getByText('bash')).toBeInTheDocument();
    expect(within(panel).getByText('rm -rf dist')).toBeInTheDocument();
    expect(within(panel).getByText('Requiere confirmación')).toBeInTheDocument();

    // Preguntas: título y estado propio (pendiente nunca como respondida).
    expect(within(panel).getByText('Preguntas')).toBeInTheDocument();
    expect(
      within(panel).getByText('¿Qué alcance tiene el cambio?'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('respondida')).toBeInTheDocument();
    expect(within(panel).getByText('¿Reescribo el histórico?')).toBeInTheDocument();
    expect(within(panel).getByText('pendiente')).toBeInTheDocument();

    // Cola: solo el turno `queue` cuenta (el `steer` no).
    expect(within(panel).getByText('Turnos en cola: 1')).toBeInTheDocument();

    expect(within(panel).queryByText(QUESTIONS_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    // La caché sembrada es la única fuente: ninguna de las cuatro consultas fue
    // a la red (el arnés fija `staleTime: Infinity`).
    expect(serviceMock.getSessionDiff).not.toHaveBeenCalled();
    expect(serviceMock.listSessionForms).not.toHaveBeenCalled();
    expect(serviceMock.getSessionPermissions).not.toHaveBeenCalled();
    expect(serviceMock.listSessionInbox).not.toHaveBeenCalled();

    // El resto del panel sigue montado (checkpoint: las cuatro secciones
    // coinciden con el resto del panel).
    expect(within(getTablist()).getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByText(NODE_TITLE)).toBeInTheDocument();
    expect(
      screen.getByText('Duración mediana por herramienta'),
    ).toBeInTheDocument();
  });

  it('con diff y formularios en 404 muestra error en ambas secciones y nunca el vacío, sin romper el panel', async () => {
    const user = setupRadixUser();
    const client = createIntegrationQueryClient();

    // Dato inexistente: las dos consultas rechazan (camino real, no caché).
    serviceMock.getSessionDiff.mockRejectedValue(
      new Error('404: session diff not found'),
    );
    serviceMock.listSessionForms.mockRejectedValue(
      new Error('404: forms not found'),
    );

    // Las otras dos fuentes de «Preguntas y permisos» sí resuelven: el error
    // manda sobre ellas (§5: error → carga → vacío → datos).
    seedPermissions(client, [], { bySession: { [SESSION_ID]: permissions } });
    seedQueryData(client, queryKeys.sessions.inbox(SESSION_ID), inboxItems);

    renderPanel(client);

    // --- Archivos: error visible y nunca el vacío ---
    let panel = await openTab(user, FILES_TAB);
    await within(panel).findByText(ERROR_TEXT);
    expect(within(panel).queryByText(FILES_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText(MODIFIED_FILE)).not.toBeInTheDocument();
    expect(serviceMock.getSessionDiff).toHaveBeenCalledWith(SESSION_ID);

    // --- Preguntas y permisos: error visible y nunca el vacío ---
    panel = await openTab(user, QUESTIONS_TAB);
    await within(panel).findByText(ERROR_TEXT);
    expect(within(panel).queryByText(QUESTIONS_EMPTY)).not.toBeInTheDocument();
    expect(within(panel).queryByText('Turnos en cola: 1')).not.toBeInTheDocument();
    expect(serviceMock.listSessionForms).toHaveBeenCalledWith(SESSION_ID);

    // --- El resto del panel no se rompe ---
    expect(within(getTablist()).getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByText(NODE_TITLE)).toBeInTheDocument();
    expect(
      screen.getByText('Duración mediana por herramienta'),
    ).toBeInTheDocument();

    // Otra sección ajena sigue operativa (el tablist no queda inutilizado).
    panel = await openTab(user, ERRORS_TAB);
    expect(within(panel).getByText('Sin errores.')).toBeInTheDocument();

    // Y al volver a Archivos el error persiste (no se degrada a vacío).
    panel = await openTab(user, FILES_TAB);
    expect(within(panel).getByText(ERROR_TEXT)).toBeInTheDocument();
    expect(within(panel).queryByText(FILES_EMPTY)).not.toBeInTheDocument();
  });
});
