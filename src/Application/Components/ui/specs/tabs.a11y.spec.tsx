import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs';

/**
 * Spec a11y del primitivo de pestañas (`ui/tabs.tsx`, Radix) (T066, FR-021,
 * SC-008; ampliado en US4, T018, FR-013 y US5, T021, FR-006).
 *
 * Verifica el **patrón APG** del tablist en su capa de primitivo: roles
 * `tablist`/`tab`/`tabpanel`, `aria-controls`/`aria-labelledby`, `aria-selected`,
 * ocultado del panel inactivo y navegación con flechas/Home/End. Es el primitivo
 * que envuelve la columna del detalle (`InspectorPane`, T025); su composición
 * `Detalle | Chat` ya se cubre en `InspectorPane.spec.tsx`, así que aquí no se
 * repiten esos casos (roving tabindex del panel concreto) y se prueba el
 * contrato general con más de dos pestañas.
 *
 * US4 añade el caso **anidado** (tablist externo de dos dentro del cual vive el
 * interno de siete secciones), `Inicio`/`Fin` sobre siete pestañas, la guardia de
 * foco por `outline` (con respaldo `forced-colors`) y el roving tabindex.
 */

const Fixture = () => (
  <Tabs defaultValue="one">
    <TabsList aria-label="Secciones">
      <TabsTrigger value="one">Uno</TabsTrigger>
      <TabsTrigger value="two">Dos</TabsTrigger>
      <TabsTrigger value="three">Tres</TabsTrigger>
    </TabsList>
    <TabsContent value="one">Contenido uno</TabsContent>
    <TabsContent value="two">Contenido dos</TabsContent>
    <TabsContent value="three">Contenido tres</TabsContent>
  </Tabs>
);

const getTab = (name: string): HTMLElement =>
  screen.getByRole('tab', { name });

/** Orden exacto de las siete secciones técnicas del detalle del nodo (contract §1). */
const SECTION_LABELS = [
  'Subagentes',
  'Archivos',
  'Herramientas',
  'Respuestas',
  'Preguntas y permisos',
  'Errores',
  'Latencia',
] as const;

/** Tablist externo `Detalle | Chat` con el tablist interno de siete secciones dentro. */
const NestedFixture = () => (
  <Tabs defaultValue="detalle">
    <TabsList aria-label="Vistas del panel de detalle">
      <TabsTrigger value="detalle">Detalle</TabsTrigger>
      <TabsTrigger value="chat">Chat</TabsTrigger>
    </TabsList>
    <TabsContent value="detalle">
      <Tabs defaultValue="s0">
        <TabsList aria-label="Secciones técnicas del nodo">
          {SECTION_LABELS.map((label, index) => (
            <TabsTrigger key={label} value={`s${index}`}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SECTION_LABELS.map((label, index) => (
          <TabsContent key={label} value={`s${index}`}>{`Contenido ${label}`}</TabsContent>
        ))}
      </Tabs>
    </TabsContent>
    <TabsContent value="chat">Contenido chat</TabsContent>
  </Tabs>
);

const getInnerTablist = (): HTMLElement =>
  screen.getByRole('tablist', { name: 'Secciones técnicas del nodo' });

const getInnerTab = (name: string): HTMLElement =>
  within(getInnerTablist()).getByRole('tab', { name });

describe('ui/tabs — patrón APG del tablist (T066, FR-021)', () => {
  it('expone tablist/tab/tabpanel y liga cada tab con su panel', () => {
    render(<Fixture />);

    const tablist = screen.getByRole('tablist', { name: 'Secciones' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Uno', 'Dos', 'Tres']);

    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();

      const panel = document.getElementById(panelId ?? '');
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
  });

  it('refleja la selección y oculta los paneles inactivos', () => {
    render(<Fixture />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

    // Los paneles inactivos siguen en el DOM pero ocultos (no accesibles).
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels).toHaveLength(3);
    expect(panels[0]).not.toHaveAttribute('hidden');
    expect(panels[1]).toHaveAttribute('hidden');
    expect(panels[2]).toHaveAttribute('hidden');
  });

  it('mueve la selección con las flechas (APG)', async () => {
    render(<Fixture />);

    const first = getTab('Uno');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(getTab('Dos')).toHaveAttribute('aria-selected', 'true'),
    );
    expect(getTab('Uno')).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(getTab('Dos'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(getTab('Uno')).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('cicla del último al primero con ArrowRight (APG, loop)', async () => {
    render(<Fixture />);

    const last = getTab('Tres');
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(getTab('Uno')).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('salta al primero/último con Home/End (APG)', async () => {
    render(<Fixture />);

    const first = getTab('Uno');
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    await waitFor(() =>
      expect(getTab('Tres')).toHaveAttribute('aria-selected', 'true'),
    );

    fireEvent.keyDown(getTab('Tres'), { key: 'Home' });
    await waitFor(() =>
      expect(getTab('Uno')).toHaveAttribute('aria-selected', 'true'),
    );
  });
});

describe('ui/tabs — anidamiento, teclado y foco (US4, FR-013/FR-021)', () => {
  it('anida dos tablists con aria-label propio e ids únicos', () => {
    render(<NestedFixture />);

    const outer = screen.getByRole('tablist', { name: 'Vistas del panel de detalle' });
    const inner = getInnerTablist();
    expect(outer).not.toBe(inner);
    expect(within(outer).getAllByRole('tab')).toHaveLength(2);
    expect(within(inner).getAllByRole('tab')).toHaveLength(7);

    const allTabs = [
      ...within(outer).getAllByRole('tab'),
      ...within(inner).getAllByRole('tab'),
    ];
    const ids = allTabs.map((tab) => tab.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    const panelIds = allTabs.map((tab) => tab.getAttribute('aria-controls'));
    expect(panelIds.every(Boolean)).toBe(true);
    expect(new Set(panelIds).size).toBe(panelIds.length);
    for (const panelId of panelIds) {
      expect(document.getElementById(panelId ?? '')).not.toBeNull();
    }

    // La lista interna: un panel visible con hijos y seis ocultos sin hijos.
    const innerPanelIds = within(inner)
      .getAllByRole('tab')
      .map((tab) => tab.getAttribute('aria-controls') ?? '');
    const innerPanels = innerPanelIds.map((id) => document.getElementById(id));
    expect(innerPanels.filter((panel) => panel?.hasAttribute('hidden'))).toHaveLength(6);
    for (const panel of innerPanels) {
      if (panel?.hasAttribute('hidden')) {
        expect(panel.textContent).toBe('');
      } else {
        expect(panel?.textContent ?? '').not.toBe('');
      }
    }
  });

  it('salta al primero/último con Inicio/Fin sobre siete pestañas', async () => {
    render(<NestedFixture />);

    const first = getInnerTab('Subagentes');
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });

    await waitFor(() =>
      expect(getInnerTab('Latencia')).toHaveAttribute('aria-selected', 'true'),
    );
    expect(getInnerTab('Subagentes')).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(getInnerTab('Latencia'), { key: 'Home' });
    await waitFor(() =>
      expect(getInnerTab('Subagentes')).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('marca el foco con outline (respaldo forced-colors), sin ring ni outline-none', () => {
    render(<NestedFixture />);

    const triggers = within(getInnerTablist()).getAllByRole('tab');
    for (const trigger of triggers) {
      expect(trigger).toHaveClass('focus-visible:outline-2');
      expect(trigger).toHaveClass('focus-visible:outline-offset-2');
      expect(trigger).toHaveClass('focus-visible:outline-ring');
      expect(trigger).toHaveClass('forced-colors:focus-visible:outline-[Highlight]');
      expect(trigger).not.toHaveClass('focus-visible:outline-none');
      expect(trigger.className).not.toMatch(/\bring-/);
    }

    const activeTrigger = triggers.find(
      (trigger) => trigger.getAttribute('aria-selected') === 'true',
    );
    const activePanel = document.getElementById(
      activeTrigger?.getAttribute('aria-controls') ?? '',
    );
    expect(activePanel).not.toBeNull();
    expect(activePanel).toHaveClass('focus-visible:outline-2');
    expect(activePanel).toHaveClass('focus-visible:outline-offset-2');
    expect(activePanel).toHaveClass('focus-visible:outline-ring');
    expect(activePanel).toHaveClass('forced-colors:focus-visible:outline-[Highlight]');
    expect(activePanel).not.toHaveClass('focus-visible:outline-none');
    expect(activePanel?.className).not.toMatch(/\bring-/);
  });

  it('usa roving tabindex: un solo punto de tabulación hasta que entra el foco (siete pestañas)', () => {
    render(<NestedFixture />);

    const tablist = getInnerTablist();
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(7);

    // Radix: el tablist es el punto de tabulación y los tabs rovan (-1) hasta
    // que entra el foco; entonces el tab activo pasa a ser el tab stop.
    expect(tablist).toHaveAttribute('tabindex', '0');
    expect(tabs.every((tab) => tab.getAttribute('tabindex') === '-1')).toBe(true);

    const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(active).toBeDefined();
    act(() => {
      (active as HTMLElement).focus();
    });
    expect(active).toHaveAttribute('tabindex', '0');
    for (const tab of tabs.filter((candidate) => candidate !== active)) {
      expect(tab).toHaveAttribute('tabindex', '-1');
    }
  });
});

/**
 * Utilidades de `display` que ganan a la regla UA de `[hidden]` (`display: none`):
 * si alguna entra en el `className` de un `TabsContent`, anula el ocultado de
 * Radix y expone todos los paneles a la vez (contract §6).
 */
const DISPLAY_UTILITIES =
  /(^|\s)(block|inline-block|inline|flex|inline-flex|grid|inline-grid|flow-root|contents|list-item|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row|table-row-group|hidden|none)(\s|$)/;

describe('ui/tabs — envoltura, alto y etiquetas (US5, T021, FR-006)', () => {
  it('la lista envuelve sin alto fijo y no duplica el override (flex-wrap + min-h-control, sin h-control)', () => {
    render(<NestedFixture />);

    const inner = getInnerTablist();
    expect(inner).toHaveClass('flex-wrap');
    expect(inner).toHaveClass('min-h-control');
    expect(inner).not.toHaveClass('h-control');

    // El tablist externo (una fila, hug) comparte el contrato del primitivo:
    // `min-h-control` conserva el alto de control al píxel.
    const outer = screen.getByRole('tablist', { name: 'Vistas del panel de detalle' });
    expect(outer).toHaveClass('flex-wrap');
    expect(outer).toHaveClass('min-h-control');
    expect(outer).not.toHaveClass('h-control');
  });

  it('no trunca etiquetas: los siete triggers son whitespace-nowrap', () => {
    render(<NestedFixture />);

    const triggers = within(getInnerTablist()).getAllByRole('tab');
    expect(triggers).toHaveLength(7);
    for (const trigger of triggers) {
      expect(trigger).toHaveClass('whitespace-nowrap');
      expect(trigger.className).not.toMatch(/\btruncate\b/);
    }

    // Etiquetas íntegras y en orden, sin abreviar (contract §6).
    expect(triggers.map((trigger) => trigger.textContent)).toEqual([...SECTION_LABELS]);
  });

  it('los paneles no usan utilidades de display que anulen [hidden]', () => {
    render(<NestedFixture />);

    const innerPanels = within(getInnerTablist())
      .getAllByRole('tab')
      .map((tab) => document.getElementById(tab.getAttribute('aria-controls') ?? ''));
    expect(innerPanels).toHaveLength(7);
    expect(innerPanels.filter((panel) => panel?.hasAttribute('hidden'))).toHaveLength(6);

    for (const panel of innerPanels) {
      expect(panel).not.toBeNull();
      expect(panel?.className ?? '').not.toMatch(DISPLAY_UTILITIES);
    }
  });
});

/**
 * Indicador de estado activo y respaldo del foco en `forced-colors` (US7, T033,
 * FR-007/FR-021; contract §6).
 *
 * El indicador no puede depender de `ring`/`box-shadow` (el contraste forzado
 * los elimina) ni provocar un salto de layout al cambiar de estado: el borde
 * está en la base de los dos estados y solo cambia de color en el activo
 * (`data-[state=active]:border-foreground`).
 */
describe('ui/tabs — indicador activo y contraste forzado (US7, T033, FR-007)', () => {
  it('marca el activo con la clase de contraste y conserva el borde en activo e inactivo (sin salto de layout)', () => {
    render(<NestedFixture />);

    const triggers = within(getInnerTablist()).getAllByRole('tab');
    expect(triggers).toHaveLength(7);

    // El borde existe en reposo (`border` + `border-transparent`) y solo cambia
    // de color en el activo: mismo ancho de caja en ambos estados.
    for (const trigger of triggers) {
      expect(trigger).toHaveClass('border');
      expect(trigger).toHaveClass('border-transparent');
      expect(trigger).toHaveClass('data-[state=active]:border-foreground');
      // Ningún cambio de ancho de borde entre estados.
      expect(trigger.className).not.toMatch(/\bborder-(0|2|4|8)\b/);
    }

    const active = triggers.find(
      (trigger) => trigger.getAttribute('aria-selected') === 'true',
    ) as HTMLElement;
    expect(active).toBeDefined();
    expect(triggers.filter((trigger) => trigger !== active)).toHaveLength(6);

    // Indicador adicional a la píldora; el `ring`/`box-shadow` queda descartado.
    expect(active).toHaveClass('data-[state=active]:border-foreground');
    expect(active).toHaveClass('data-[state=active]:bg-background');
    expect(active).toHaveClass('data-[state=active]:text-foreground');
    expect(active.className).not.toMatch(/\bfocus-visible:ring|ring-offset/);
  });

  it('respalda el foco con forced-colors:outline-[Highlight] en activo e inactivo', () => {
    render(<NestedFixture />);

    const triggers = within(getInnerTablist()).getAllByRole('tab');
    for (const trigger of triggers) {
      expect(trigger).toHaveClass('focus-visible:outline-2');
      expect(trigger).toHaveClass('focus-visible:outline-offset-2');
      expect(trigger).toHaveClass('focus-visible:outline-ring');
      expect(trigger).toHaveClass('forced-colors:focus-visible:outline-[Highlight]');
      expect(trigger).not.toHaveClass('focus-visible:outline-none');
    }

    const active = triggers.find(
      (trigger) => trigger.getAttribute('aria-selected') === 'true',
    ) as HTMLElement;
    act(() => {
      active.focus();
    });

    // El foco no cambia el estado activo ni pierde el respaldo de contraste.
    expect(active).toHaveFocus();
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveClass('forced-colors:focus-visible:outline-[Highlight]');
    expect(active).toHaveClass('data-[state=active]:border-foreground');
    expect(active).not.toHaveClass('focus-visible:outline-none');
  });
});
