import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ChatOptionCombobox,
  type ChatOptionComboboxProps,
} from '../ChatOptionCombobox';

/**
 * Specs del control `ChatOptionCombobox` (feature 009, iteración UX E).
 *
 * Molecule presentacional: chip compacto con **buscador interno** y lista de
 * **altura máxima** para listas largas (agente/modelo). Sustituye al Radix
 * `Select` por `Popover` + `Command` (cmdk), así que cambia el rol: el disparador
 * es un `<button role="combobox">` y el input de búsqueda interno es el
 * `combobox` editable. Se verifica búsqueda case-insensitive, estado vacío,
 * altura/scroll, selección, teclado y estado deshabilitado (WCAG 2.2 AA).
 *
 * cmdk usa `ResizeObserver` (jsdom no lo implementa) y Radix depende de
 * `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView`; se stubbean.
 */

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const AGENTS = [
  { value: 'build', label: 'Build' },
  { value: 'plan', label: 'Plan' },
  { value: 'explore', label: 'Explore' },
];

const renderCombobox = (overrides: Partial<ChatOptionComboboxProps> = {}) => {
  const onValueChange = vi.fn<ChatOptionComboboxProps['onValueChange']>();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(
    <ChatOptionCombobox
      label="Agente"
      value=""
      placeholder="Elegir agente"
      options={AGENTS}
      onValueChange={onValueChange}
      {...overrides}
    />,
  );
  return { user, onValueChange, view };
};

const getTrigger = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Agente' });

const getSearch = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Buscar agente' });

const optionLabels = (): (string | null)[] =>
  screen.getAllByRole('option').map((option) => option.textContent);

describe('ChatOptionCombobox', () => {
  it('exposes an accessible name via an sr-only label', () => {
    renderCombobox();

    const label = screen.getByText('Agente');
    const trigger = getTrigger();

    expect(label).toHaveAttribute('for', trigger.id);
    expect(trigger).toHaveAttribute('id');
    expect(label).toHaveClass('sr-only');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders a compact chip with the current value and a chevron', () => {
    renderCombobox({ value: 'plan' });

    const trigger = getTrigger();

    expect(trigger).toHaveTextContent('Plan');
    expect(trigger).toHaveClass('rounded-full');
    expect(trigger).toHaveClass('w-auto');
    expect(trigger).toHaveClass('h-8');
    // El chip puede encoger por debajo de su contenido y truncar etiquetas largas
    // (p. ej. nombres de modelo extensos) sin forzar scroll horizontal.
    expect(trigger).toHaveClass('min-w-0');
    const valueLabel = trigger.querySelector('span');
    expect(valueLabel).toHaveClass('truncate');
    expect(valueLabel).toHaveClass('max-w-[12rem]');
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('shows the placeholder when there is no value', () => {
    renderCombobox();

    expect(getTrigger()).toHaveTextContent('Elegir agente');
  });

  it('lists the options when opened', async () => {
    const { user } = renderCombobox();

    await user.click(getTrigger());

    expect(optionLabels()).toEqual(['Build', 'Plan', 'Explore']);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('filters the options case-insensitively by label', async () => {
    const { user } = renderCombobox();

    await user.click(getTrigger());
    await user.type(getSearch(), 'PLAN');

    expect(optionLabels()).toEqual(['Plan']);
  });

  it('shows an empty state when nothing matches', async () => {
    const { user } = renderCombobox();

    await user.click(getTrigger());
    await user.type(getSearch(), 'zzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('caps the list height and scrolls', async () => {
    const { user } = renderCombobox();

    await user.click(getTrigger());

    const list = screen.getByRole('listbox');
    expect(list).toHaveClass('max-h-60');
    expect(list).toHaveClass('overflow-y-auto');
  });

  it('emits the chosen option and closes the popover', async () => {
    const { user, onValueChange } = renderCombobox();

    await user.click(getTrigger());
    await user.click(screen.getByRole('option', { name: 'Plan' }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('plan');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens with the keyboard and closes with Escape', async () => {
    const { user } = renderCombobox();
    const trigger = getTrigger();

    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('navigates with arrows and selects with Enter', async () => {
    const { user, onValueChange } = renderCombobox();

    await user.click(getTrigger());
    // Al abrir, cmdk deja activa la primera opción; una flecha avanza a la siguiente.
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('plan');
  });

  it('does not open when disabled', async () => {
    const { user } = renderCombobox({ disabled: true });
    const trigger = getTrigger();

    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
