/**
 * U20 (T019) — E2E de frontera **U5↔U4/U3**: anidamiento de los dos tablists.
 *
 * Monta `WorkspacePage` con `renderWorkspace` + arnés compartido (`./harness`):
 * el grafo, las sesiones, el chat y el histórico van por marcadores, pero el
 * **panel del detalle es el real** (`InspectorPanel` de T010, NO el marcador):
 * por eso `@app/Domains/Inspector` **no** se mockea. Así la frontera observa el
 * patrón anidado de verdad — tablist externo `Detalle | Chat` (U5/`InspectorPane`)
 * conteniendo el tablist interno de secciones técnicas (U4/`InspectorSectionTabs`,
 * U3/`useInspectorSectionTabs`) — con el modelo y los hooks reales y la caché
 * sembrada (`sessions.list/roots/status`, `graph.for(directory, sessionId)`,
 * `sessions.messages(id)` y el diff vacío de cada nodo).
 *
 * Cubre `contracts/inspector-section-tabs-contract.md` §1/§2 y FR-013:
 *
 * 1. **Anidamiento**: dos `role="tablist"` con `aria-label` propios y distintos
 *    (`Vistas del panel de detalle` / `Secciones técnicas del nodo`), `id`s y
 *    `aria-controls` únicos entre ambos, y el interno viviendo **dentro** del
 *    tabpanel `Detalle` del externo. El nodo se selecciona por el control
 *    «Seleccionar nodo» del marcador `agent-graph`.
 * 2. **Teclado**: el tablist interno navega con ←/→ (activación automática) sin
 *    mover el externo; el externo conserva su propio recorrido.
 * 3. **Caso negativo (dato inexistente)**: sin nodo inspeccionable (subárbol
 *    vacío) sólo existe el tablist externo (1) y el detalle muestra el prompt;
 *    ninguna consulta global por rol queda ambigua.
 * 4. **Rama móvil (§1/§2)**: con la presentación móvil (`showDetailTabs={false}`)
 *    el tablist externo `Detalle | Chat` no se monta y el de secciones técnicas
 *    pasa a ser el **único** del detalle, dentro del tabpanel `inspector` del
 *    tablist de primer nivel del workspace. Sin nodo inspeccionable el panel
 *    queda en el prompt y no hay tablist de secciones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { assistantMessage } from '@app/Domains/Graph/lib/specs/fixtures';
import {
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  INSPECTOR_SECTION_TABS_TEST_ID,
} from '@app/Domains/Inspector';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  buildSessionInfo,
  createIntegrationQueryClient,
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedQueryData,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

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

// `@app/Domains/Inspector` NO se mockea a propósito: la frontera exige el panel
// **real** (T010) para que el tablist de secciones se monte de verdad.

vi.mock('@app/Domains/History', async () => {
  const { mockHistoryBarrel } = await import('./harness');
  return mockHistoryBarrel();
});

const ROOT_ID = INTEGRATION_SESSION_ID;
const CHILD_ID = INTEGRATION_CHILD_SESSION_ID;

/** `aria-label` congelado del tablist externo (`InspectorPane`). */
const EXTERNAL_TABLIST_LABEL = 'Vistas del panel de detalle';

/** `aria-label` congelado del tablist interno (contrato §2). */
const INTERNAL_TABLIST_LABEL = INSPECTOR_SECTION_TABS_ARIA_LABEL;

/** Etiquetas de las siete secciones, en orden (contrato §1, FR-005). */
const SECTION_LABELS = INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.label);

/** Prompt del detalle sin nodo (`InspectorEmptyPrompt`, SC-003). */
const EMPTY_PROMPT = 'Selecciona un nodo del grafo para ver su detalle.';

/** `aria-label` del tablist de primer nivel del workspace (solo móvil). */
const WORKSPACE_TABLIST_LABEL = 'Vistas del workspace';

/** Pestaña de primer nivel que hospeda el panel del detalle (móvil). */
const INSPECTOR_WORKSPACE_TAB = 'inspector';

const rootSession = () => buildSessionInfo();

/** Hija de subagente del subárbol: segundo nodo, con arista desde la raíz. */
const childSession = () =>
  buildSessionInfo({
    id: CHILD_ID,
    parentID: ROOT_ID,
    title: 'subtarea',
    time: { created: 3, updated: 4 },
  });

/**
 * Workspace abierto en escritorio con la raíz y su hija en el subárbol, sus
 * mensajes en caché (contenido real para el enriquecimiento y la sección
 * Subagentes) y el diff vacío de cada nodo —clave que `resetServiceMock` no deja
 * con valor por defecto—.
 */
const seedWorkspace = (client: QueryClient): void => {
  seedSessions(client, [rootSession(), childSession()]);
  seedSubtree(client, [rootSession(), childSession()]);
  seedMessages(client, {
    [ROOT_ID]: [assistantMessage()],
    [CHILD_ID]: [],
  });
  seedQueryData(client, queryKeys.sessions.diff(ROOT_ID), []);
  seedQueryData(client, queryKeys.sessions.diff(CHILD_ID), []);
  seedDevice(client, false);
};

/**
 * Caso negativo: la sesión abierta no reporta agentes (subárbol vacío), así que
 * el inspector no tiene nodo que mostrar y el panel queda en el prompt.
 */
const seedEmptyGraph = (client: QueryClient): void => {
  seedSessions(client, [rootSession()]);
  seedSubtree(client, []);
  seedDevice(client, false);
};

/** El mismo workspace, en la presentación **móvil** (`showDetailTabs={false}`). */
const seedMobileWorkspace = (client: QueryClient): void => {
  seedWorkspace(client);
  seedDevice(client, true);
};

/** El subárbol vacío, en la presentación **móvil**. */
const seedMobileEmptyGraph = (client: QueryClient): void => {
  seedEmptyGraph(client);
  seedDevice(client, true);
};

const getExternalTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: EXTERNAL_TABLIST_LABEL });

const getInternalTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INTERNAL_TABLIST_LABEL });

/** Monta el workspace, espera el grafo y selecciona el primer nodo del marcador. */
const openNodeDetail = async (): Promise<void> => {
  const client = createIntegrationQueryClient();
  seedWorkspace(client);

  await renderWorkspace(client);
  const graph = await screen.findByTestId(TESTID.agentGraph);

  fireEvent.click(within(graph).getByRole('button', { name: 'Seleccionar nodo' }));
  expect(graph.getAttribute('data-selected')).not.toBe('');
};

beforeEach(() => {
  resetServiceMock();
});

describe('U5↔U4/U3 — anidamiento de tablists en el detalle del nodo (T019, FR-013)', () => {
  it(
    'anida el tablist de secciones dentro del tabpanel Detalle, con labels e ids propios',
    async () => {
      await openNodeDetail();

      const external = getExternalTablist();
      const internal = getInternalTablist();

      // Dos tablists distintos, cada uno con su `aria-label` (contract §2).
      expect(EXTERNAL_TABLIST_LABEL).not.toBe(INTERNAL_TABLIST_LABEL);
      expect(external).toHaveAttribute('aria-label', EXTERNAL_TABLIST_LABEL);
      expect(internal).toHaveAttribute('aria-label', INTERNAL_TABLIST_LABEL);
      expect(internal).not.toBe(external);
      expect(screen.getAllByRole('tablist')).toHaveLength(2);
      expect(internal).toHaveAttribute(
        'data-testid',
        INSPECTOR_SECTION_TABS_TEST_ID,
      );
      expect(external).not.toHaveAttribute(
        'data-testid',
        INSPECTOR_SECTION_TABS_TEST_ID,
      );

      // El interno vive **dentro** del tabpanel `Detalle` del externo.
      const detailPanel = screen.getByRole('tabpanel', { name: 'Detalle' });
      expect(detailPanel).toContainElement(internal);
      expect(detailPanel).not.toContainElement(external);
      expect(external.contains(internal)).toBe(false);
      expect(internal.contains(external)).toBe(false);

      // La lista interna es la del contrato, en orden; el externo no la cambia.
      expect(
        within(internal)
          .getAllByRole('tab')
          .map((tab) => tab.textContent),
      ).toEqual(SECTION_LABELS);
      expect(
        within(external)
          .getAllByRole('tab')
          .map((tab) => tab.textContent),
      ).toEqual(['Detalle', 'Chat']);

      // `id` y `aria-controls` únicos entre ambos tablists (Radix `useId`).
      const tabs = [
        ...within(external).getAllByRole('tab'),
        ...within(internal).getAllByRole('tab'),
      ];
      expect(tabs).toHaveLength(2 + SECTION_LABELS.length);

      const ids = tabs.map((tab) => tab.id);
      expect(ids.filter(Boolean)).toHaveLength(tabs.length);
      expect(new Set(ids).size).toBe(tabs.length);

      const controls = tabs.map((tab) => tab.getAttribute('aria-controls'));
      expect(controls.every(Boolean)).toBe(true);
      expect(new Set(controls).size).toBe(tabs.length);

      // Cada `aria-controls` apunta al tabpanel de su propia pestaña.
      for (const tab of tabs) {
        const panel = document.getElementById(
          tab.getAttribute('aria-controls') ?? '',
        );
        expect(panel).not.toBeNull();
        expect(panel).toHaveAttribute('role', 'tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
      }

      // El resto del workspace sigue sano (el panel real no rompe la vista).
      expect(screen.getByTestId('inspector-pane')).toBeInTheDocument();
      expect(screen.queryByTestId(TESTID.graphSkeleton)).toBeNull();
    },
    { timeout: 15_000 },
  );

  it(
    'el tablist interno navega con ←/→ sin mover el externo, que conserva su recorrido',
    async () => {
      await openNodeDetail();

      const external = getExternalTablist();
      const internal = getInternalTablist();
      const externalTabs = within(external).getAllByRole('tab');
      const internalTabs = within(internal).getAllByRole('tab');

      // Arranque en la primera sección sin acción previa (contract §4).
      expect(internalTabs).toHaveLength(SECTION_LABELS.length);
      expect(internalTabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(externalTabs[0]).toHaveAttribute('aria-selected', 'true');

      // La lista entera se recorre con →, activando cada sección sin mover el
      // externo (checkpoint de US4).
      act(() => {
        internalTabs[0].focus();
      });
      for (let index = 1; index < internalTabs.length; index += 1) {
        fireEvent.keyDown(internalTabs[index - 1], { key: 'ArrowRight' });

        await waitFor(() =>
          expect(internalTabs[index]).toHaveAttribute('aria-selected', 'true'),
        );
        expect(externalTabs[0]).toHaveAttribute('aria-selected', 'true');
      }

      // ← y `Inicio` devuelven la selección al principio; el externo sigue igual.
      fireEvent.keyDown(internalTabs[internalTabs.length - 1], {
        key: 'ArrowLeft',
      });
      await waitFor(() =>
        expect(
          internalTabs[internalTabs.length - 2],
        ).toHaveAttribute('aria-selected', 'true'),
      );
      fireEvent.keyDown(internalTabs[internalTabs.length - 2], { key: 'Home' });
      await waitFor(() =>
        expect(internalTabs[0]).toHaveAttribute('aria-selected', 'true'),
      );
      expect(externalTabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(externalTabs[1]).toHaveAttribute('aria-selected', 'false');

      // El externo sigue operativo con sus propias flechas (`Detalle` → `Chat`).
      act(() => {
        externalTabs[0].focus();
      });
      fireEvent.keyDown(externalTabs[0], { key: 'ArrowRight' });

      await waitFor(() =>
        expect(externalTabs[1]).toHaveAttribute('aria-selected', 'true'),
      );
      expect(externalTabs[0]).toHaveAttribute('aria-selected', 'false');
      // Al ocultarse `Detalle`, su contenido (el tablist interno) sale del árbol
      // accesible; el externo permanece.
      expect(getExternalTablist()).toBe(external);
      expect(
        screen.queryByRole('tablist', { name: INTERNAL_TABLIST_LABEL }),
      ).toBeNull();
    },
    { timeout: 15_000 },
  );

  it(
    'sin nodo inspeccionable sólo existe el tablist externo y el detalle muestra el prompt',
    async () => {
      const client = createIntegrationQueryClient();
      seedEmptyGraph(client);

      await renderWorkspace(client);

      // El grafo se resolvió en vacío (estado terminal, no carga) y el detalle
      // queda sin nodo: prompt explícito.
      expect(await screen.findByText('Sin agentes')).toBeInTheDocument();
      expect(screen.queryByTestId(TESTID.graphSkeleton)).toBeNull();
      expect(screen.getByText(EMPTY_PROMPT)).toBeInTheDocument();

      // Un único tablist en todo el documento: el externo.
      expect(screen.getAllByRole('tablist')).toHaveLength(1);
      const external = screen.getByRole('tablist');
      expect(external).toHaveAttribute('aria-label', EXTERNAL_TABLIST_LABEL);
      expect(
        screen.queryByRole('tablist', { name: INTERNAL_TABLIST_LABEL }),
      ).toBeNull();
      expect(
        screen.queryByRole('tablist', {
          name: INTERNAL_TABLIST_LABEL,
          hidden: true,
        }),
      ).toBeNull();
      expect(
        screen.queryByTestId(INSPECTOR_SECTION_TABS_TEST_ID),
      ).toBeNull();

      // Ninguna consulta global por rol queda ambigua: un solo tablist, un solo
      // tabpanel visible (el `Detalle`) y las dos pestañas externas.
      const externalTabs = within(external).getAllByRole('tab');
      expect(screen.getAllByRole('tab')).toHaveLength(2);
      expect(screen.getByRole('tab', { name: 'Detalle' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        externalTabs[0].id,
      );
      expect(
        screen.queryByRole('tab', { name: SECTION_LABELS[0] }),
      ).toBeNull();
    },
    { timeout: 15_000 },
  );
});

describe('U5↔U4/U3 — el tablist de secciones en móvil (§1/§2, FR-013)', () => {
  it(
    'en móvil el tablist de secciones es el único del detalle (sin `Detalle | Chat`)',
    async () => {
      const client = createIntegrationQueryClient();
      seedMobileWorkspace(client);

      await renderWorkspace(client);
      const graph = await screen.findByTestId(TESTID.agentGraph);

      fireEvent.click(
        within(graph).getByRole('button', { name: 'Seleccionar nodo' }),
      );
      expect(graph.getAttribute('data-selected')).not.toBe('');

      // El detalle es un destino de **primer nivel** en móvil (FR-013): se
      // activa por el tablist del workspace, no por un `Detalle | Chat`.
      fireEvent.click(
        screen.getByRole('tab', { name: INSPECTOR_WORKSPACE_TAB }),
      );

      const internal = await screen.findByRole('tablist', {
        name: INTERNAL_TABLIST_LABEL,
      });

      // §1: sin tablist externo, el interno es el único tablist del detalle.
      expect(
        screen.queryByRole('tablist', { name: EXTERNAL_TABLIST_LABEL }),
      ).toBeNull();
      expect(
        screen.queryByRole('tablist', {
          name: EXTERNAL_TABLIST_LABEL,
          hidden: true,
        }),
      ).toBeNull();

      // Y vive directamente en el tabpanel del tab de primer nivel `inspector`.
      const inspectorPanel = screen.getByRole('tabpanel', {
        name: INSPECTOR_WORKSPACE_TAB,
      });
      expect(inspectorPanel).toContainElement(internal);

      // §1/§4: las siete etiquetas en orden y una sola activa.
      const tabs = within(internal).getAllByRole('tab');
      expect(tabs.map((tab) => tab.textContent)).toEqual(SECTION_LABELS);
      expect(
        tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true'),
      ).toHaveLength(1);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      // Los dos tablists del documento: el del workspace y el de secciones.
      expect(screen.getAllByRole('tablist')).toHaveLength(2);
      expect(
        screen.getByRole('tablist', { name: WORKSPACE_TABLIST_LABEL }),
      ).toBeInTheDocument();
    },
    { timeout: 15_000 },
  );

  it(
    'en móvil sin nodo inspeccionable el detalle muestra el prompt y ningún tablist de secciones',
    async () => {
      const client = createIntegrationQueryClient();
      seedMobileEmptyGraph(client);

      await renderWorkspace(client);

      // El grafo resolvió en vacío (estado terminal, no carga).
      expect(await screen.findByText('Sin agentes')).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('tab', { name: INSPECTOR_WORKSPACE_TAB }),
      );

      expect(screen.getByText(EMPTY_PROMPT)).toBeInTheDocument();

      // Dato inexistente: ni el tablist de secciones ni el externo se inventan.
      expect(
        screen.queryByRole('tablist', { name: INTERNAL_TABLIST_LABEL }),
      ).toBeNull();
      expect(
        screen.queryByRole('tablist', {
          name: INTERNAL_TABLIST_LABEL,
          hidden: true,
        }),
      ).toBeNull();
      expect(
        screen.queryByTestId(INSPECTOR_SECTION_TABS_TEST_ID),
      ).toBeNull();

      // No vacuidad: el tablist de primer nivel del workspace sigue montado.
      expect(screen.getAllByRole('tablist')).toHaveLength(1);
      expect(
        screen.getByRole('tablist', { name: WORKSPACE_TABLIST_LABEL }),
      ).toBeInTheDocument();
    },
    { timeout: 15_000 },
  );
});
