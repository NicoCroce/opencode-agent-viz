/**
 * U03 (T009) — E2E de frontera **U2↔U3**: cadena `useInspectorSectionTabs` →
 * pestaña activa.
 *
 * Monta el **componente real** `InspectorSectionTabs` del dominio Inspector (no
 * un marcador) con el **hook real** y secciones stub, dentro de
 * `renderWithProviders` + `createIntegrationQueryClient` del arnés
 * (`./harness`). No hay red en la cadena: el componente es presentación pura y
 * el estado activo sale del hook.
 *
 * Cubre `contracts/inspector-section-tabs-contract.md` §3/§4 y `data-model.md`
 * §1-§2:
 *
 * 1. **Frontera de arranque**: `tab` inicial (`subagents`) ⇒ una sola sección
 *    visible, con hijos montados, sin acción previa y sin desplegable.
 * 2. **Frontera de etiqueta → sección**: las siete etiquetas del hook montan su
 *    propia sección (mapa exhaustivo, sin secciones cruzadas ni paneles vacíos).
 * 3. **Frontera de interacción**: clic y ←/→/`Inicio`/`Fin` cambian la sección
 *    montada; siempre un solo panel con hijos y seis `hidden` **sin hijos**.
 * 4. **Caso negativo (dato inexistente)**: un disparo con id **fuera de la
 *    unión** por el camino `onValueChange`/`setTab` del componente real deja la
 *    pestaña en `subagents`, con exactamente una `aria-selected="true"` y sin
 *    paneles huérfanos ni vacíos de contenido.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { TabsList, TabsTrigger } from '@app/Application/Components';
import {
  InspectorSectionTabs,
  INSPECTOR_SECTION_PANEL_TEST_ID,
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  INSPECTOR_SECTION_TABS_TEST_ID,
  type TInspectorSectionTab,
} from '@app/Domains/Inspector';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import { createIntegrationQueryClient } from './harness';

/** Etiquetas literales de las siete pestañas, en orden (contract §1, FR-005). */
const SECTION_TAB_LABELS: Record<TInspectorSectionTab, string> = {
  subagents: 'Subagentes',
  files: 'Archivos',
  tools: 'Herramientas',
  answers: 'Respuestas',
  questions: 'Preguntas y permisos',
  errors: 'Errores',
  latency: 'Latencia',
};

/** Orden del contrato, del que deriva el hook (FR-001). */
const SECTION_TAB_ORDER: readonly TInspectorSectionTab[] = [
  'subagents',
  'files',
  'tools',
  'answers',
  'questions',
  'errors',
  'latency',
];

/** Texto identificable de cada stub de sección. */
const SECTION_STUB_TEXT: Record<TInspectorSectionTab, string> = {
  subagents: 'Stub de subagentes',
  files: 'Stub de archivos',
  tools: 'Stub de herramientas',
  answers: 'Stub de respuestas',
  questions: 'Stub de preguntas',
  errors: 'Stub de errores',
  latency: 'Stub de latencia',
};

/**
 * Id **fuera de la unión** (dato inexistente). Radix solo emite valores de sus
 * propios `TabsTrigger`, así que un id inválido no puede nacer de la lista real:
 * la sonda lo dispara por el mismo camino (`Tabs` → `onValueChange`) sin
 * sustituir el componente. El `TabsList` anidado comparte el contexto de `Tabs`
 * del componente (no abre uno nuevo), de modo que el `TabsTrigger` sonda invoca
 * **su** `handleValueChange`/`setTab`.
 */
const OUT_OF_UNION_TAB = 'ghost' as TInspectorSectionTab;

/** `aria-label` propio de la sonda (el tablist real conserva el suyo). */
const PROBE_TABSLIST_LABEL = 'Sonda de valor fuera de la unión';

const OutOfUnionProbe = () => (
  <TabsList aria-label={PROBE_TABSLIST_LABEL}>
    <TabsTrigger value={OUT_OF_UNION_TAB}>Fuera de la unión</TabsTrigger>
  </TabsList>
);

const buildSections = ({ probe = false }: { probe?: boolean } = {}): Record<
  TInspectorSectionTab,
  ReactNode
> => ({
  subagents: (
    <div>
      <p>{SECTION_STUB_TEXT.subagents}</p>
      {probe ? <OutOfUnionProbe /> : null}
    </div>
  ),
  files: <p>{SECTION_STUB_TEXT.files}</p>,
  tools: <p>{SECTION_STUB_TEXT.tools}</p>,
  answers: <p>{SECTION_STUB_TEXT.answers}</p>,
  questions: <p>{SECTION_STUB_TEXT.questions}</p>,
  errors: <p>{SECTION_STUB_TEXT.errors}</p>,
  latency: <p>{SECTION_STUB_TEXT.latency}</p>,
});

/** Monta el componente real con el hook real y el cliente del arnés. */
const renderTabs = (options: { probe?: boolean } = {}) =>
  renderWithProviders(
    <InspectorSectionTabs sections={buildSections(options)} />,
    { queryClient: createIntegrationQueryClient() },
  );

const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

const getTabs = (): HTMLElement[] => within(getTablist()).getAllByRole('tab');

const getTab = (id: TInspectorSectionTab): HTMLElement =>
  within(getTablist()).getByRole('tab', {
    name: SECTION_TAB_LABELS[id],
  });

/** Todos los paneles del componente real (Radix los deja en el DOM). */
const getPanels = (): HTMLElement[] =>
  screen.getAllByRole('tabpanel', { hidden: true });

const getHiddenPanels = (): HTMLElement[] =>
  getPanels().filter((panel) => panel.hasAttribute('hidden'));

const getActivePanel = (): HTMLElement => screen.getByRole('tabpanel');

/** Tablist propio de la sonda (el real se consulta por su `aria-label`). */
const getProbeTab = (): HTMLElement =>
  within(screen.getByRole('tablist', { name: PROBE_TABSLIST_LABEL })).getByRole(
    'tab',
  );

/**
 * `baseId` que Radix deriva de su contexto `Tabs` (`trigger-<baseId>-<value>`).
 * Dos disparos con el mismo `baseId` pertenecen al **mismo** `Tabs`: la sonda
 * entra por el `onValueChange` del componente real, no por una lista ajena.
 */
const tabsBaseIdOf = (tab: HTMLElement, value: string): string =>
  tab.id.slice('trigger-'.length, -(value.length + 1));

/**
 * Invariante del contrato §4 y de `data-model.md` §2: exactamente **una**
 * pestaña activa, exactamente **un** panel visible con el contenido de esa
 * sección, seis `hidden` sin hijos y **ningún panel huérfano** (cada panel lo
 * referencia exactamente una pestaña de la lista).
 */
const expectSingleActiveSection = (expected: TInspectorSectionTab): void => {
  const tabs = getTabs();
  expect(tabs).toHaveLength(7);

  const selected = tabs.filter(
    (tab) => tab.getAttribute('aria-selected') === 'true',
  );
  expect(selected).toHaveLength(1);
  expect(selected[0]).toHaveTextContent(SECTION_TAB_LABELS[expected]);

  const panels = getPanels();
  const referencedIds = tabs.map((tab) => tab.getAttribute('aria-controls'));

  for (const panel of panels) {
    expect(panel).toHaveAttribute(
      'data-testid',
      INSPECTOR_SECTION_PANEL_TEST_ID,
    );
    expect(referencedIds.filter((id) => id === panel.id)).toHaveLength(1);
  }

  const visible = panels.filter((panel) => !panel.hasAttribute('hidden'));
  expect(visible).toHaveLength(1);
  expect(visible[0]).toHaveTextContent(SECTION_STUB_TEXT[expected]);
  expect(visible[0].textContent?.trim()).not.toBe('');

  const hidden = getHiddenPanels();
  expect(hidden).toHaveLength(6);
  for (const panel of hidden) {
    expect(panel).toBeEmptyDOMElement();
  }
};

describe('InspectorSectionTabs — frontera hook → pestaña activa (§3/§4)', () => {
  it('arranca en subagents con una sola sección montada y sin desplegable', () => {
    const { container } = renderTabs();

    // El tablist real es el del componente (hook real, `data-testid` propio).
    expect(getTablist()).toHaveAttribute(
      'data-testid',
      INSPECTOR_SECTION_TABS_TEST_ID,
    );

    // Frontera de arranque: el valor inicial del hook llega a la lista y al DOM.
    expect(getTabs().map((tab) => tab.textContent)).toEqual(
      SECTION_TAB_ORDER.map((id) => SECTION_TAB_LABELS[id]),
    );
    expect(SECTION_TAB_ORDER.map((id) => SECTION_TAB_LABELS[id])).toEqual(
      INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.label),
    );

    expectSingleActiveSection('subagents');

    // Checkpoint de US1: no queda el desplegable "Avanzado" ni role="region".
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('cada etiqueta del hook monta su propia sección (mapa exhaustivo)', async () => {
    const user = setupRadixUser();
    renderTabs();

    for (const id of SECTION_TAB_ORDER) {
      await user.click(getTab(id));

      await waitFor(() =>
        expect(getTab(id)).toHaveAttribute('aria-selected', 'true'),
      );
      expectSingleActiveSection(id);
      // Ninguna sección cruzada: el panel visible no trae otro stub.
      for (const other of SECTION_TAB_ORDER) {
        if (other === id) continue;
        expect(getActivePanel()).not.toHaveTextContent(
          SECTION_STUB_TEXT[other],
        );
      }
    }
  });

  it('cambia la sección montada con ←/→ e Inicio/Fin (activación automática)', async () => {
    renderTabs();

    act(() => {
      getTab('subagents').focus();
    });
    fireEvent.keyDown(getTab('subagents'), { key: 'ArrowRight' });

    await waitFor(() =>
      expect(getTab('files')).toHaveAttribute('aria-selected', 'true'),
    );
    expectSingleActiveSection('files');

    fireEvent.keyDown(getTab('files'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(getTab('subagents')).toHaveAttribute('aria-selected', 'true'),
    );
    expectSingleActiveSection('subagents');

    fireEvent.keyDown(getTab('subagents'), { key: 'End' });
    await waitFor(() =>
      expect(getTab('latency')).toHaveAttribute('aria-selected', 'true'),
    );
    expectSingleActiveSection('latency');

    fireEvent.keyDown(getTab('latency'), { key: 'Home' });
    await waitFor(() =>
      expect(getTab('subagents')).toHaveAttribute('aria-selected', 'true'),
    );
    expectSingleActiveSection('subagents');
  });

  it('un id fuera de la unión deja la pestaña en subagents, sin paneles huérfanos ni vacíos', async () => {
    const user = setupRadixUser();
    renderTabs({ probe: true });

    expectSingleActiveSection('subagents');

    // La sonda comparte el contexto `Tabs` real: su disparo llega al
    // `onValueChange` del componente (mismo `baseId` de Radix), no a un `Tabs`
    // ajeno, así que la guarda del hook es la que corta el id inexistente.
    expect(tabsBaseIdOf(getProbeTab(), OUT_OF_UNION_TAB)).toBe(
      tabsBaseIdOf(getTab('subagents'), 'subagents'),
    );

    // Dato inexistente: el id no pertenece a `INSPECTOR_SECTION_TABS`.
    await user.click(getProbeTab());

    // El disparo llegó a la sonda (foco real + activación automática de Radix);
    // la guarda del hook corta el id inválido: nada cambia en el componente real.
    expect(getProbeTab()).toHaveFocus();
    expect(getProbeTab()).toHaveAttribute('aria-selected', 'false');
    expectSingleActiveSection('subagents');

    // Y sigue funcionando: el tablist real conserva su comportamiento.
    await user.click(getTab('tools'));
    await waitFor(() =>
      expect(getTab('tools')).toHaveAttribute('aria-selected', 'true'),
    );
    expectSingleActiveSection('tools');
  });
});
