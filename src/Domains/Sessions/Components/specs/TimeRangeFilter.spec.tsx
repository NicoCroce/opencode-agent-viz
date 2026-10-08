import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TIME_RANGES, type TTimeRange } from '../../lib/sessionFilters';
import { TimeRangeFilter } from '../TimeRangeFilter';

/**
 * Specs de `TimeRangeFilter` (feature 005, T019, FR-006..FR-009, FR-021).
 *
 * Contrato congelado:
 * `specs/005-session-filters/contracts/session-filters-contract.md` §4.
 *
 * El control reutiliza el `Select` existente en modo controlado: ofrece los
 * cinco rangos predefinidos (FR-007), refleja el rango activo en su disparador
 * (FR-008, FR-021) y notifica el cambio vía `onChange` con el valor del rango
 * (`1h` / `24h` / `7d` / `30d` / `all`).
 *
 * Radix `Select` depende de APIs que jsdom no implementa
 * (`hasPointerCapture`/`releasePointerCapture`/`scrollIntoView`) y bloquea el
 * puntero fuera del portal mientras está abierto; por eso se mockean esas APIs
 * y se desactiva la comprobación de `pointer-events` en `userEvent`.
 */

/** Etiquetas visibles esperadas, en el orden de `TIME_RANGES` (FR-007). */
const RANGE_LABELS: string[] = [
  'Última hora',
  'Últimas 24 horas',
  'Últimos 7 días',
  'Últimos 30 días',
  'Todo',
];

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const renderFilter = (value: TTimeRange = 'all', onChange = vi.fn()) => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<TimeRangeFilter value={value} onChange={onChange} />);
  return { user, onChange };
};

const getTrigger = (): HTMLElement => screen.getByRole('combobox');

const openOptions = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(getTrigger());
};

describe('TimeRangeFilter', () => {
  it('offers exactly the five predefined ranges (FR-007)', async () => {
    const { user } = renderFilter();
    await openOptions(user);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(TIME_RANGES.length);
    expect(options.map((option) => option.textContent)).toEqual(RANGE_LABELS);
  });

  it('reflects the active range on the trigger (FR-008, FR-021)', () => {
    renderFilter('24h');

    expect(getTrigger()).toHaveTextContent('Últimas 24 horas');
  });

  it('shows "Todo" when the active range is the default (FR-008)', () => {
    renderFilter('all');

    expect(getTrigger()).toHaveTextContent('Todo');
  });

  it('names the control and exposes the active range as the combobox value (FR-021)', async () => {
    const { user } = renderFilter('7d');
    const trigger = screen.getByRole('combobox', {
      name: 'Filtrar por recencia',
    });

    expect(trigger).toHaveTextContent('Últimos 7 días');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await openOptions(user);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onChange with the chosen range (FR-006, FR-007)', async () => {
    const onChange = vi.fn();
    const { user } = renderFilter('all', onChange);
    await openOptions(user);

    await user.click(
      screen.getByRole('option', { name: 'Últimas 24 horas' }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('24h');
  });

  it('calls onChange with "all" when choosing "Todo" (FR-008)', async () => {
    const onChange = vi.fn();
    const { user } = renderFilter('1h', onChange);
    await openOptions(user);

    await user.click(screen.getByRole('option', { name: 'Todo' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('is operable by keyboard and announces the active range (FR-021)', async () => {
    const { user } = renderFilter('30d');
    const trigger = getTrigger();

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('option')).toHaveLength(TIME_RANGES.length);
  });

  it('selects a range with the keyboard (FR-021)', async () => {
    const onChange = vi.fn();
    const { user } = renderFilter('all', onChange);
    const trigger = getTrigger();

    await user.tab();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Desde "Todo" (última opción) `ArrowUp` resalta la anterior; `ArrowDown`
    // no tiene candidata y no movería el foco. Radix aplica el foco en un
    // `setTimeout`, por eso se espera al resaltado antes de confirmar.
    await user.keyboard('{ArrowUp}');
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'Últimos 30 días' }),
      ).toHaveFocus(),
    );
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('30d');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes the options with Escape and returns focus to the trigger (FR-021)', async () => {
    const { user } = renderFilter('all');
    const trigger = getTrigger();

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('option')).toHaveLength(TIME_RANGES.length);

    await user.keyboard('{Escape}');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
});
