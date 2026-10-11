import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs';

/**
 * Spec a11y del primitivo de pestañas (`ui/tabs.tsx`, Radix) (T066, FR-021,
 * SC-008).
 *
 * Verifica el **patrón APG** del tablist en su capa de primitivo: roles
 * `tablist`/`tab`/`tabpanel`, `aria-controls`/`aria-labelledby`, `aria-selected`,
 * ocultado del panel inactivo y navegación con flechas/Home/End. Es el primitivo
 * que envuelve la columna del detalle (`InspectorPane`, T025); su composición
 * `Detalle | Chat` ya se cubre en `InspectorPane.spec.tsx`, así que aquí no se
 * repiten esos casos (roving tabindex del panel concreto) y se prueba el
 * contrato general con más de dos pestañas.
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
