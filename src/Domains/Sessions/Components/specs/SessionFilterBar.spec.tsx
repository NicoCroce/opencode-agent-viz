import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TProjectOption, TTimeRange } from '../../lib/sessionFilters';
import { SessionFilterBar } from '../SessionFilterBar';

/**
 * Specs de `SessionFilterBar` (feature 005, T011 + T025, FR-024, FR-025, SC-006).
 *
 * Contrato congelado:
 * `specs/005-session-filters/contracts/session-filters-contract.md` §1–§2.
 *
 * La barra es una fila **siempre visible** sobre el listado, entre el título y
 * los grupos, que aloja el control de proyecto y el control temporal sin
 * requerir ninguna acción previa para acceder a ellos (FR-024). Es presentación
 * pura: reenvía `options`, `selectedProjects`, `range` y los manejadores a los
 * controles, y no conoce la URL.
 *
 * Con filtros activos (`hasActiveFilters`) muestra, sin expandir nada, un
 * **resumen** (`N proyectos · <etiqueta de rango>`) y la acción "Limpiar
 * filtros" (FR-025, SC-006). Esa acción lleva el nombre accesible
 * "Limpiar filtros de la barra" para no colisionar con el botón homónimo que
 * `EmptyScreenFilter` renderiza en la misma pantalla (FR-021); estos specs la
 * consultan por ese nombre accesible, nunca por el texto "Limpiar filtros".
 *
 * Radix `Select` (montado por `TimeRangeFilter`) usa APIs que jsdom no
 * implementa; se mockean para poder renderizar la barra completa con el control
 * temporal conectado.
 */

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const options: TProjectOption[] = [
  {
    directory: '/Users/dev/proj-a',
    name: 'proj-a',
    path: '/Users/dev/proj-a',
    count: 2,
  },
  {
    directory: '/Users/dev/proj-b',
    name: 'proj-b',
    path: '/Users/dev/proj-b',
    count: 1,
  },
];

interface RenderBarOverrides {
  selectedProjects?: string[];
  onToggleProject?: (directory: string) => void;
  range?: TTimeRange;
  onRangeChange?: (range: TTimeRange) => void;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}

const renderBar = (overrides: RenderBarOverrides = {}) => {
  const user = userEvent.setup();
  const onToggleProject = overrides.onToggleProject ?? vi.fn();
  const onClear = overrides.onClear ?? vi.fn();

  render(
    <SessionFilterBar
      options={options}
      selectedProjects={overrides.selectedProjects ?? []}
      onToggleProject={onToggleProject}
      range={overrides.range}
      onRangeChange={overrides.onRangeChange}
      hasActiveFilters={overrides.hasActiveFilters}
      onClear={overrides.onClear}
    />,
  );

  return {
    user,
    onToggleProject,
    onClear,
    onRangeChange: overrides.onRangeChange,
  };
};

const getBar = (): HTMLElement => screen.getByTestId('session-filter-bar');

const getTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: /filtrar por proyecto/i });

/**
 * Acción de limpiar de la barra. Se consulta por su nombre accesible
 * desambiguado (no por el texto "Limpiar filtros") para no confundirla con la
 * acción homónima de `EmptyScreenFilter` (FR-021).
 */
const getClearAction = (): HTMLElement =>
  screen.getByRole('button', { name: 'Limpiar filtros de la barra' });

describe('SessionFilterBar', () => {
  it('renders the project control and stays visible without expanding anything (FR-024)', () => {
    renderBar();

    expect(getBar()).toBeVisible();
    expect(getTrigger()).toBeVisible();
    expect(getTrigger()).toHaveTextContent('Todos');
  });

  it('reflects the selected projects forwarded to the bar (FR-002)', () => {
    renderBar({ selectedProjects: ['/Users/dev/proj-a'] });

    expect(getTrigger()).toHaveTextContent('1 proyecto');
  });

  it('forwards the toggle handler to the project control (FR-002)', async () => {
    const onToggleProject = vi.fn();
    const { user } = renderBar({ onToggleProject });

    await user.click(getTrigger());
    await user.click(screen.getByRole('checkbox', { name: /proj-b/ }));

    expect(onToggleProject).toHaveBeenCalledTimes(1);
    expect(onToggleProject).toHaveBeenCalledWith('/Users/dev/proj-b');
  });

  it('summarizes the active filters as "N proyectos · <rango>" (FR-025, SC-006)', () => {
    renderBar({
      selectedProjects: ['/Users/dev/proj-a', '/Users/dev/proj-b'],
      range: '24h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    expect(screen.getByText('2 proyectos · Últimas 24 horas')).toBeVisible();
  });

  it('summarizes a single selected project as "1 proyecto" (FR-025)', () => {
    renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: '7d',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    expect(screen.getByText('1 proyecto · Últimos 7 días')).toBeVisible();
  });

  it('shows "Todos" in the summary when only the range filter is active (FR-003, FR-025)', () => {
    renderBar({
      range: '1h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    expect(screen.getByText('Todos · Última hora')).toBeVisible();
  });

  it('omits the summary and the clear action while no filter is active (FR-025)', () => {
    renderBar();

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /limpiar filtros/i }),
    ).not.toBeInTheDocument();
    expect(getTrigger()).toBeVisible();
  });

  it('offers the clear action with the bar-specific accessible name (FR-021, FR-025)', () => {
    renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: 'all',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    const clearAction = getClearAction();
    expect(clearAction).toBeVisible();
    expect(clearAction).toHaveTextContent('Limpiar filtros');
  });

  it('clears the filters through the bar action (FR-012, SC-006)', async () => {
    const onClear = vi.fn();
    const { user } = renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: '24h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear,
    });

    await user.click(getClearAction());

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('keeps both controls visible while filters are active (FR-024)', () => {
    renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: '24h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    expect(getTrigger()).toBeVisible();
    expect(screen.getByRole('combobox')).toBeVisible();
  });

  it('announces the active selection through the project trigger name (FR-021)', () => {
    renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: '24h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear: vi.fn(),
    });

    expect(
      screen.getByRole('button', { name: 'Filtrar por proyecto: 1 proyecto' }),
    ).toBeVisible();
  });

  it('reaches and activates the clear action with the keyboard (FR-021)', async () => {
    const onClear = vi.fn();
    const { user } = renderBar({
      selectedProjects: ['/Users/dev/proj-a'],
      range: '24h',
      onRangeChange: vi.fn(),
      hasActiveFilters: true,
      onClear,
    });
    const clearAction = getClearAction();

    for (let i = 0; i < 5 && document.activeElement !== clearAction; i += 1) {
      await user.tab();
    }

    expect(clearAction).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
