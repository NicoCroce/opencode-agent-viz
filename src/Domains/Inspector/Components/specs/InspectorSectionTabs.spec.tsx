import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  InspectorSectionTabs,
  INSPECTOR_SECTION_PANEL_CLASSNAME,
  INSPECTOR_SECTION_PANEL_TEST_ID,
  INSPECTOR_SECTION_TABS_TEST_ID,
} from '../InspectorSectionTabs';
import {
  INSPECTOR_SECTION_TAB_ITEMS,
  INSPECTOR_SECTION_TABS_ARIA_LABEL,
  INSPECTOR_SECTION_TABS_LIST_CLASSNAME,
  type TInspectorSectionTab,
} from '../../Hooks/useInspectorSectionTabs';

/**
 * Contrato de `InspectorSectionTabs` (FR-001/FR-002/FR-005/FR-013,
 * `contracts/inspector-section-tabs-contract.md` §1-§3 y §8).
 *
 * Cubre el patrón APG del tablist interno —siete pestañas, un solo panel vivo,
 * seis `hidden` **sin hijos**, `aria-controls`/`aria-labelledby` ligados,
 * flechas e `Inicio`/`Fin`—, el `aria-label` propio y distinto del externo, los
 * `data-testid`, las guardias de clase (sin utilidades de `display` que
 * anularían `[hidden]`) y la ausencia de insignias/`aria-expanded` del
 * desplegable retirado. El componente es presentación pura: las secciones
 * llegan como stubs identificables por props.
 */

/** Etiqueta del tablist externo `Detalle | Chat` (FR-013). */
const EXTERNAL_TABS_ARIA_LABEL = 'Vistas del panel de detalle';

/** Etiquetas literales de las siete pestañas, en orden (FR-001/FR-005). */
const SECTION_TAB_LABELS = [
  'Subagentes',
  'Archivos',
  'Herramientas',
  'Respuestas',
  'Preguntas y permisos',
  'Errores',
  'Latencia',
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

const buildSections = (): Record<TInspectorSectionTab, ReactNode> => ({
  subagents: <p>{SECTION_STUB_TEXT.subagents}</p>,
  files: <p>{SECTION_STUB_TEXT.files}</p>,
  tools: <p>{SECTION_STUB_TEXT.tools}</p>,
  answers: <p>{SECTION_STUB_TEXT.answers}</p>,
  questions: <p>{SECTION_STUB_TEXT.questions}</p>,
  errors: <p>{SECTION_STUB_TEXT.errors}</p>,
  latency: <p>{SECTION_STUB_TEXT.latency}</p>,
});

const renderTabs = () =>
  renderWithProviders(<InspectorSectionTabs sections={buildSections()} />);

const getTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: INSPECTOR_SECTION_TABS_ARIA_LABEL });

const getTab = (name: string): HTMLElement => screen.getByRole('tab', { name });

/** Todos los paneles, visibles y ocultos (Radix los deja en el DOM). */
const getPanels = (): HTMLElement[] =>
  screen.getAllByRole('tabpanel', { hidden: true });

const getHiddenPanels = (): HTMLElement[] =>
  getPanels().filter((panel) => panel.hasAttribute('hidden'));

/**
 * Utilidades de `display` prohibidas en el `className` de un `TabsContent`:
 * anulan `[hidden]` y expondrían los siete paneles (contract §2, 1.3.1/2.4.3).
 * El patrón admite variantes (`md:flex`) y exige límite de token.
 */
const DISPLAY_UTILITY_PATTERN =
  /(?:^|\s)(?:[a-z-]+:)*(?:hidden|block|inline|inline-block|inline-flex|flex|grid|contents|table|flow-root)(?=\s|$)/;

describe('InspectorSectionTabs — tablist interno (FR-001/FR-005/FR-013)', () => {
  it('rinde el tablist con aria-label propio, distinto del externo, y data-testid', () => {
    renderTabs();

    const tablist = getTablist();

    expect(tablist).toHaveAttribute(
      'aria-label',
      INSPECTOR_SECTION_TABS_ARIA_LABEL,
    );
    expect(tablist.getAttribute('aria-label')).not.toBe(
      EXTERNAL_TABS_ARIA_LABEL,
    );
    expect(tablist).toHaveAttribute(
      'data-testid',
      INSPECTOR_SECTION_TABS_TEST_ID,
    );
    // La lista envuelve en filas por el primitivo; el call site solo añade
    // ancho completo y alineación (contract §6).
    expect(tablist).toHaveClass(
      ...INSPECTOR_SECTION_TABS_LIST_CLASSNAME.split(' '),
    );
    // `orientation` horizontal: la lista puede envolver, pero las flechas
    // verticales no navegan entre filas (contract §2).
    expect(tablist).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('rinde las siete pestañas en el orden y con las etiquetas del contrato', () => {
    renderTabs();

    const tabs = within(getTablist()).getAllByRole('tab');

    expect(tabs).toHaveLength(7);
    expect(tabs.map((tab) => tab.textContent)).toEqual(SECTION_TAB_LABELS);
    // Las etiquetas del spec son las de la constante centralizada: un renombrado
    // se detecta aquí aunque el orden siga siendo correcto (FR-005).
    expect(SECTION_TAB_LABELS).toEqual(
      INSPECTOR_SECTION_TAB_ITEMS.map((item) => item.label),
    );
    // Exactamente una activa en todo momento (FR-002).
    expect(
      tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('no añade insignias ni contadores a las pestañas (FR-005/FR-013)', () => {
    renderTabs();

    const tablist = getTablist();

    // El texto de cada trigger es la etiqueta, sin sufijos numéricos.
    for (const tab of within(tablist).getAllByRole('tab')) {
      expect(tab.textContent).toMatch(/^[^0-9]*$/);
    }
    expect(within(tablist).queryAllByText(/^\d+$/)).toHaveLength(0);
    expect(tablist.querySelectorAll('[class*="badge" i]')).toHaveLength(0);
    expect(tablist.querySelectorAll('[data-testid*="badge" i]')).toHaveLength(
      0,
    );
  });
});

describe('InspectorSectionTabs — un solo panel vivo (FR-002)', () => {
  it('mantiene los siete paneles y monta hijos solo en el activo', () => {
    renderTabs();

    const panels = getPanels();
    expect(panels).toHaveLength(7);
    expect(panels.filter((panel) => panel.hasAttribute('hidden'))).toHaveLength(
      6,
    );

    const active = screen.getByRole('tabpanel');
    expect(
      within(active).getByText(SECTION_STUB_TEXT.subagents),
    ).toBeInTheDocument();

    for (const panel of getHiddenPanels()) {
      expect(panel).toBeEmptyDOMElement();
    }
  });

  it('etiqueta cada panel con data-testid', () => {
    renderTabs();

    for (const panel of getPanels()) {
      expect(panel).toHaveAttribute(
        'data-testid',
        INSPECTOR_SECTION_PANEL_TEST_ID,
      );
    }
  });

  it('liga cada pestaña con su panel (aria-controls / aria-labelledby)', () => {
    renderTabs();

    for (const [index, tab] of within(getTablist())
      .getAllByRole('tab')
      .entries()) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();

      const panel = document.getElementById(panelId ?? '');
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
      expect(tab.id).toBeTruthy();
      // Los paneles siguen el mismo orden que las pestañas (DOM).
      expect(panel).toBe(getPanels()[index]);
    }
  });

  it('no usa role="region" dentro de los paneles (contract §2)', () => {
    renderTabs();

    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('no deja utilidades de display en el className de los paneles', () => {
    renderTabs();

    expect(INSPECTOR_SECTION_PANEL_CLASSNAME).toBe(
      'min-w-0 cursor-default mt-3',
    );

    for (const panel of getPanels()) {
      expect(panel.className).not.toMatch(DISPLAY_UTILITY_PATTERN);
      expect(panel).toHaveClass(
        ...INSPECTOR_SECTION_PANEL_CLASSNAME.split(' '),
      );
    }
  });

  it('no expone el desplegable retirado: sin aria-expanded', () => {
    const { container } = renderTabs();

    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    for (const tab of within(getTablist()).getAllByRole('tab')) {
      expect(tab).not.toHaveAttribute('aria-expanded');
    }
  });
});

describe('InspectorSectionTabs — estado efímero (FR-003)', () => {
  it('mantiene la pestaña en re-renders y vuelve a Subagentes al remontar', async () => {
    const user = setupRadixUser();
    const { rerender, unmount } = renderTabs();

    await user.click(getTab('Archivos'));
    await waitFor(() =>
      expect(getTab('Archivos')).toHaveAttribute('aria-selected', 'true'),
    );

    // Cambio de nodo (nuevas secciones) ⇒ la selección no se reinicia.
    rerender(<InspectorSectionTabs sections={buildSections()} />);
    expect(getTab('Archivos')).toHaveAttribute('aria-selected', 'true');

    // Cierre y reapertura del detalle ⇒ el remontaje vuelve al inicial.
    unmount();
    renderTabs();

    expect(getTab('Subagentes')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      SECTION_STUB_TEXT.subagents,
    );
  });
});

describe('InspectorSectionTabs — interacción (FR-002, APG)', () => {
  it('cambia de panel con el puntero y deja vacío el anterior', async () => {
    const user = setupRadixUser();
    renderTabs();

    await user.click(getTab('Errores'));

    await waitFor(() =>
      expect(getTab('Errores')).toHaveAttribute('aria-selected', 'true'),
    );

    const active = screen.getByRole('tabpanel');
    expect(
      within(active).getByText(SECTION_STUB_TEXT.errors),
    ).toBeInTheDocument();
    expect(getHiddenPanels()).toHaveLength(6);
    for (const panel of getHiddenPanels()) {
      expect(panel).toBeEmptyDOMElement();
    }
    expect(within(active).queryByText(SECTION_STUB_TEXT.subagents)).toBeNull();
  });

  it('aplica roving tabindex: un único punto de tabulación en la lista', async () => {
    renderTabs();

    const tablist = getTablist();
    const tabs = within(tablist).getAllByRole('tab');

    // A descanso la entrada al tablist la da el grupo (Radix): `Tab` entra a la
    // lista y enfoca la pestaña activa. Las pestañas no son tabulables aún.
    expect(tablist).toHaveAttribute('tabindex', '0');
    for (const tab of tabs) {
      expect(tab).toHaveAttribute('tabindex', '-1');
    }

    // Al enfocar una pestaña, esa pasa a ser el punto de tabulación y las demás
    // quedan fuera del orden de tabulación (APG).
    act(() => {
      tabs[2].focus();
    });

    await waitFor(() => expect(tabs[2]).toHaveAttribute('tabindex', '0'));
    expect(
      tabs.filter((tab) => tab.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('tabindex', '-1');
  });

  it('mueve la selección con ←/→ y la activa (activación automática)', async () => {
    renderTabs();

    const first = getTab(SECTION_TAB_LABELS[0]);
    act(() => {
      first.focus();
    });
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(getTab(SECTION_TAB_LABELS[1])).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(first).toHaveAttribute('aria-selected', 'false');
    expect(
      within(screen.getByRole('tabpanel')).getByText(SECTION_STUB_TEXT.files),
    ).toBeInTheDocument();

    fireEvent.keyDown(getTab(SECTION_TAB_LABELS[1]), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(getTab(SECTION_TAB_LABELS[0])).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('salta a la primera/última pestaña con Inicio/Fin', async () => {
    renderTabs();

    const first = getTab(SECTION_TAB_LABELS[0]);
    act(() => {
      first.focus();
    });
    fireEvent.keyDown(first, { key: 'End' });

    await waitFor(() =>
      expect(getTab(SECTION_TAB_LABELS[6])).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(
      within(screen.getByRole('tabpanel')).getByText(SECTION_STUB_TEXT.latency),
    ).toBeInTheDocument();

    fireEvent.keyDown(getTab(SECTION_TAB_LABELS[6]), { key: 'Home' });
    await waitFor(() =>
      expect(getTab(SECTION_TAB_LABELS[0])).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('ignora las flechas verticales: la orientación es horizontal', () => {
    renderTabs();

    const first = getTab(SECTION_TAB_LABELS[0]);
    act(() => {
      first.focus();
    });
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });

    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(getHiddenPanels()).toHaveLength(6);
  });
});
