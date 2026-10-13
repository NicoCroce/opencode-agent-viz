/**
 * U25 (T022) — E2E de frontera **U1↔U3** (contract §6/§5, FR-006,
 * SC-002/SC-003): el primitivo compartido (`ui/tabs.tsx`) aplicado al tablist
 * interno de secciones técnicas.
 *
 * Monta el `InspectorPanel` **real** (no el marcador del arnés) con
 * `renderWithProviders` + `createIntegrationQueryClient` y el SDK mockeado por
 * el arnés (`serviceMock`/`resetServiceMock`), con la caché sembrada **vacía**:
 * los mensajes, el diff, las preguntas, los permisos, la bandeja, el contexto,
 * los servidores MCP y las instrucciones resuelven a `[]` (dato inexistente),
 * de modo que cada panel cae en su estado vacío legítimo en vez de en carga.
 * Las siete secciones son las **reales** (no marcadores): la frontera U1↔U3
 * exige observar el contenido montado de verdad.
 *
 * **Anchos mínimo y máximo simulados** (SC-003): el panel de producción vive en
 * una columna redimensionable de `[INSPECTOR_MIN_WIDTH, INSPECTOR_MAX_WIDTH]`
 * px, y como jsdom no mide layout el ancho se simula fijando el ancho de la
 * columna que envuelve al panel (mismo criterio que
 * `detailChatTablistRegression.integration.spec.tsx`). La garantía observable
 * es de **clases y texto**: la lista conserva el alto de control y puede
 * envolver (`min-h-control` + `flex-wrap`, sin `h-control`), ninguna etiqueta
 * se trunca (`whitespace-nowrap`, sin utilidades de recorte) y el número de
 * pestañas no cambia con el ancho.
 *
 * Cubre:
 *
 * 1. §6 (U1→U3): alto automático + envoltura del primitivo en la lista interna,
 *    sin duplicar el override de alto desde el call site y sin scroll
 *    horizontal; las siete etiquetas completas y en orden en los dos anchos.
 * 2. §5: un solo `tabpanel` montado con hijos; los seis inactivos `hidden`,
 *    **sin hijos** y ligados (`aria-labelledby`) a una pestaña no seleccionada.
 * 3. **Caso negativo (dato inexistente)**: recorriendo las siete pestañas,
 *    solo la activa monta hijos y las seis restantes siguen vacías; ninguna
 *    sección aparece dos veces entre el resumen y las pestañas (0 duplicados,
 *    SC-002) y el desplegable "Avanzado" (eliminado en T012) ya no existe.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import {
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from '@app/Application/Helpers/panelWidth';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import {
  INSPECTOR_SECTION_PANEL_TEST_ID,
  INSPECTOR_SECTION_TABS_TEST_ID,
} from '@app/Domains/Inspector/Components/InspectorSectionTabs';
import {
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  INSPECTOR_SECTION_TABS_LIST_CLASSNAME,
  type TInspectorSectionTab,
} from '@app/Domains/Inspector/Hooks/useInspectorSectionTabs';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '@app/Domains/queryKeys';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedForms,
  seedMessages,
  seedPermissions,
  seedQueryData,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */
/* -------------------------------------------------------------------------- */

const SESSION_ID = 'ses_section_tabs';
const DIRECTORY = '/repo/section-tabs';

/** Etiquetas literales de las siete pestañas, en orden (contract §1). */
const SECTION_LABELS = INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.label);

/** Etiqueta de cada pestaña indexada por id. */
const LABEL_BY_TAB = Object.fromEntries(
  INSPECTOR_SECTION_TAB_ITEMS.map((item) => [item.id, item.label]),
) as Record<TInspectorSectionTab, string>;

/**
 * Encabezados de las secciones del **resumen continuo** (contract §1): ninguno
 * puede aparecer dentro del área de pestañas (SC-002, segunda mitad).
 */
const SUMMARY_HEADINGS = [
  'Modelo',
  'Métricas',
  'Contexto',
  'Recursos',
  'Duración mediana por herramienta',
  'Paralelismo',
  'Aporte al padre',
];

/** Anchos simulados del panel: los límites de la columna en producción. */
const PANEL_WIDTHS: readonly (readonly [label: string, width: number])[] = [
  ['mínimo', INSPECTOR_MIN_WIDTH],
  ['máximo', INSPECTOR_MAX_WIDTH],
];

/** `data-testid` de la columna que simula el ancho del panel. */
const PANEL_COLUMN_TEST_ID = 'panel-column';

/**
 * Utilidades que recortarían una etiqueta (SC-003): truncado, elipsis,
 * recorte oculto o cambio de `white-space` que permita partirla en dos líneas.
 */
const TRUNCATION_UTILITIES =
  /\btruncate\b|\btext-ellipsis\b|\bline-clamp-\d|\boverflow-hidden\b|\bwhitespace-(normal|pre)\b/;

/**
 * Nodo mínimo del grafo (identidad + métricas) para que el panel componga el
 * resumen continuo; sin `context` para no inventar series de latencia.
 */
const buildNode = (): TGraphNode => ({
  id: SESSION_ID,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: SESSION_ID,
    title: 'Tarea de secciones',
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: DIRECTORY,
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

/**
 * Siembra la caché del panel con **dato inexistente**: todas las fuentes que
 * alimentan las siete secciones resuelven a `[]`, así que cada panel queda en
 * su estado vacío legítimo (nunca en carga) desde el primer render.
 */
const seedEmptyPanelCache = (client: QueryClient): void => {
  seedMessages(client, { [SESSION_ID]: [] });
  seedForms(client, { questions: { [SESSION_ID]: [] } });
  seedPermissions(client, [], { bySession: { [SESSION_ID]: [] } });
  seedQueryData(client, queryKeys.sessions.diff(SESSION_ID), []);
  seedQueryData(client, queryKeys.sessions.inbox(SESSION_ID), []);
  seedQueryData(client, queryKeys.sessions.context(SESSION_ID), []);
  seedQueryData(client, queryKeys.mcp.servers(DIRECTORY), []);
  seedQueryData(client, queryKeys.sessions.instructions(SESSION_ID), []);
};

/** Columna del panel: simula el ancho mínimo/máximo de producción. */
const PanelColumn = ({ width }: { width: number }) => (
  <div data-testid={PANEL_COLUMN_TEST_ID} style={{ width }}>
    <InspectorPanel node={buildNode()} />
  </div>
);

/** Monta el panel real en una columna del ancho indicado, con la caché sembrada. */
const renderPanelAt = (width: number): RenderResult =>
  renderWithProviders(<PanelColumn width={width} />, {
    queryClient: createIntegrationQueryClient(),
    seed: seedEmptyPanelCache,
  });

/* -------------------------------------------------------------------------- */
/* Consultas                                                                    */
/* -------------------------------------------------------------------------- */

const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

const getTab = (id: TInspectorSectionTab): HTMLElement =>
  screen.getByRole('tab', { name: LABEL_BY_TAB[id] });

/** Raíz del panel: la `Container` que `InspectorPanel` rinde dentro de la columna. */
const getPanelRoot = (): HTMLElement =>
  screen.getByTestId(PANEL_COLUMN_TEST_ID).firstElementChild as HTMLElement;

/**
 * Encabezados de sección (`SectionHeading`, un `span`) con ese texto exacto
 * dentro de `root`. Los `TabsTrigger` son botones, así que no cuentan: esto
 * aísla los **bloques** de sección de sus etiquetas de pestaña.
 */
const headingsWithText = (root: HTMLElement, text: string): HTMLElement[] =>
  Array.from(root.querySelectorAll('span')).filter(
    (span) => span.textContent === text,
  );

/** Paneles del tablist interno (`TabsContent`), activo e inactivos. */
const getPanels = (): HTMLElement[] =>
  screen.getAllByTestId(INSPECTOR_SECTION_PANEL_TEST_ID);

const isHiddenPanel = (panel: HTMLElement): boolean =>
  panel.hasAttribute('hidden');

/** Selecciona una pestaña y espera a que Radix refleje la activación. */
const selectTab = async (id: TInspectorSectionTab): Promise<void> => {
  const user = setupRadixUser();
  await user.click(getTab(id));
  await waitFor(() =>
    expect(getTab(id)).toHaveAttribute('aria-selected', 'true'),
  );
};

beforeEach(() => {
  resetServiceMock(serviceMock);
});

describe('U1↔U3 — el primitivo en el tablist interno de secciones (T022, §6/§5)', () => {
  it.each(PANEL_WIDTHS)(
    'en ancho %s (%i px) la lista conserva el alto, envuelve y no recorta etiquetas',
    (_label, width) => {
      renderPanelAt(width);

      // Ancho simulado (jsdom no mide layout): la columna es la que aguanta los
      // 280–720 px de producción.
      expect(screen.getByTestId(PANEL_COLUMN_TEST_ID).style.width).toBe(
        `${width}px`,
      );

      const tablist = getTablist();
      expect(tablist).toHaveAttribute(
        'data-testid',
        INSPECTOR_SECTION_TABS_TEST_ID,
      );
      expect(tablist).toHaveAttribute(
        'aria-label',
        INSPECTOR_SECTION_TABS_ARIA_LABEL,
      );

      // §6: alto automático (`min-h-control`, que conserva el alto de control
      // del tablist externo al píxel) + envoltura en filas cuando el ancho la
      // restringe; sin `h-control` fijo.
      expect(tablist).toHaveClass('min-h-control', 'flex-wrap');
      expect(tablist).not.toHaveClass('h-control');
      expect(tablist).toHaveClass(
        ...INSPECTOR_SECTION_TABS_LIST_CLASSNAME.split(' '),
      );

      // El call site no duplica el override de alto ni pide scroll horizontal.
      expect(INSPECTOR_SECTION_TABS_LIST_CLASSNAME).not.toMatch(
        /\b(h|min-h|max-h)-/,
      );
      expect(tablist.className).not.toMatch(/\boverflow-x-(auto|scroll)\b/);

      // §6/SC-003: las siete etiquetas, íntegras y en orden, sin truncado.
      const triggers = within(tablist).getAllByRole('tab');
      expect(triggers).toHaveLength(SECTION_LABELS.length);
      expect(triggers.map((trigger) => trigger.textContent)).toEqual(
        SECTION_LABELS,
      );
      for (const trigger of triggers) {
        expect(trigger).toHaveClass('whitespace-nowrap');
        expect(trigger.className).not.toMatch(TRUNCATION_UTILITIES);
      }

      // §5: un solo panel con hijos; los seis inactivos `hidden` y sin hijos.
      const panels = getPanels();
      expect(panels).toHaveLength(SECTION_LABELS.length);

      const visible = panels.filter((panel) => !isHiddenPanel(panel));
      const hidden = panels.filter(isHiddenPanel);
      expect(visible).toHaveLength(1);
      expect(hidden).toHaveLength(6);
      expect(visible[0].childElementCount).toBeGreaterThan(0);

      expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
      expect(screen.getByRole('tabpanel')).toBe(visible[0]);
      expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(
        SECTION_LABELS.length,
      );

      for (const panel of hidden) {
        expect(panel.childElementCount).toBe(0);
        expect(panel.textContent).toBe('');

        // Cada panel oculto sigue ligado a su pestaña, que no está seleccionada.
        const labelledBy = panel.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        const tab = document.getElementById(labelledBy ?? '');
        expect(tab).toHaveAttribute('role', 'tab');
        expect(tab).toHaveAttribute('aria-selected', 'false');
      }
    },
  );

  it('no duplica ninguna sección entre el resumen y las pestañas (0 duplicados, SC-002)', async () => {
    renderPanelAt(INSPECTOR_MIN_WIDTH);

    const panelRoot = getPanelRoot();
    const tabsRoot = getTablist().parentElement as HTMLElement;

    // §1: el tablist interno es el último bloque del eje vertical.
    expect(panelRoot.lastElementChild).toBe(tabsRoot);
    // No vacuidad: el resumen continuo (Modelo, Contexto, …) sigue montado.
    expect(panelRoot.children.length).toBeGreaterThan(1);

    /** Encabezados con ese texto que viven **fuera** del área de pestañas. */
    const headingsInSummary = (text: string): HTMLElement[] =>
      headingsWithText(panelRoot, text).filter(
        (span) => !tabsRoot.contains(span),
      );

    expect(headingsInSummary('Modelo')).toHaveLength(1);

    // Ninguna sección técnica vive en el resumen.
    for (const label of SECTION_LABELS) {
      expect(headingsInSummary(label)).toHaveLength(0);
    }
    // Ninguna sección del resumen vive dentro del área de pestañas.
    for (const label of SUMMARY_HEADINGS) {
      expect(headingsWithText(tabsRoot, label)).toHaveLength(0);
    }

    // Al recorrer las siete pestañas, cada sección aparece **exactamente una**
    // vez en el panel y dentro de su propio `tabpanel` activo.
    for (const item of INSPECTOR_SECTION_TAB_ITEMS) {
      await selectTab(item.id);

      const headings = headingsWithText(panelRoot, item.label);
      expect(headings).toHaveLength(1);
      expect(screen.getByRole('tabpanel')).toContainElement(headings[0]);
    }

    // El desplegable "Avanzado" (eliminado en T012) ya no duplica secciones.
    expect(screen.queryByText('Avanzado')).toBeNull();
  });

  it('con dato inexistente solo la pestaña activa monta hijos y las seis restantes siguen vacías', async () => {
    renderPanelAt(INSPECTOR_MIN_WIDTH);

    const panelRoot = getPanelRoot();

    for (const item of INSPECTOR_SECTION_TAB_ITEMS) {
      await selectTab(item.id);

      const panels = getPanels();
      const active = panels.filter((panel) => !isHiddenPanel(panel));
      const inactive = panels.filter(isHiddenPanel);

      // La pestaña en turno es la única que monta contenido…
      expect(active).toHaveLength(1);
      expect(active[0].childElementCount).toBeGreaterThan(0);
      expect(screen.getByRole('tabpanel')).toBe(active[0]);

      // …y su encabezado es el único bloque de esa sección en todo el panel.
      expect(headingsWithText(panelRoot, item.label)).toHaveLength(1);

      // …mientras los seis paneles inactivos quedan `hidden` y **sin hijos**.
      expect(inactive).toHaveLength(6);
      for (const panel of inactive) {
        expect(panel.childElementCount).toBe(0);
        expect(panel.textContent).toBe('');
      }
    }

    // El vacío de dato inexistente es el legítimo del panel activo (Subagentes),
    // no un tablist desmontado: las siete etiquetas siguen ahí.
    await selectTab('subagents');
    expect(
      within(screen.getByRole('tabpanel')).getByText(
        'Sin subagentes ni agentes en paralelo.',
      ),
    ).toBeInTheDocument();
    expect(
      within(getTablist()).getAllByRole('tab').map((tab) => tab.textContent),
    ).toEqual(SECTION_LABELS);
  });
});
