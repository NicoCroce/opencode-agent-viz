import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSessionFilters } from '../useSessionFilters';
import { FILTER_PARAM_KEYS } from '../../lib/sessionFilters';
import type { TSessionGroup } from '../useRootSessions';
import { buildSessionGroups } from '../../specs/fixtures';

/**
 * Specs del hook de estado de filtros (feature 005, T008).
 *
 * Contrato congelado: `specs/005-session-filters/contracts/session-filters-contract.md`
 * §2–§5 y §7. La dirección de la página es la única fuente de estado, así que
 * todos los casos se montan con `MemoryRouter` + `initialEntries` y se observa
 * cómo el hook restaura, degrada y recompone el resultado.
 *
 * `useNow` se activa solo con un rango acotado; la ventana rodante (FR-022,
 * SC-007) se prueba con temporizadores falsos para que el cruce de frontera sea
 * determinista.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Instante base de los fixtures, próximo al reloj real del test. */
const NOW = Date.now();

/** Grupos de referencia: dos proyectos con sesiones y uno solo con antiguas. */
const groups = buildSessionGroups([
  {
    directory: '/repo/alpha',
    sessions: [
      { id: 'alpha-recent', updated: NOW - 1_000 },
      { id: 'alpha-old', updated: NOW - 10 * DAY_MS },
    ],
  },
  {
    directory: '/repo/beta',
    sessions: [{ id: 'beta-recent', updated: NOW - 2_000 }],
  },
  {
    directory: '/repo/gamma',
    sessions: [{ id: 'gamma-old', updated: NOW - 10 * DAY_MS }],
  },
]);

/** Última dirección observada por el `LocationProbe`. */
let lastSearch = '';

/** Lee la dirección del router para verificar qué parámetros sobreviven. */
const LocationProbe = () => {
  const { search } = useLocation();

  // Se captura en un efecto (nunca durante el render) para respetar la pureza.
  useEffect(() => {
    lastSearch = search;
  }, [search]);

  return null;
};

/** Wrapper con el router en la entrada indicada. */
const makeWrapper = (initialEntries: string[]) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      {children}
    </MemoryRouter>
  );
  Wrapper.displayName = 'SessionFiltersRouterWrapper';
  return Wrapper;
};

/** Construye una URL de la página del listado con los parámetros dados. */
const urlWith = (params: Record<string, string>): string =>
  `/sessions?${new URLSearchParams(params).toString()}`;

/** Monta el hook con los grupos y la dirección inicial indicados. */
const renderFilters = (
  currentGroups: TSessionGroup[] = groups,
  initialEntries: string[] = ['/sessions'],
) => {
  lastSearch = '';
  return renderHook(() => useSessionFilters(currentGroups), {
    wrapper: makeWrapper(initialEntries),
  });
};

const visibleSessionIds = (result: {
  filteredGroups: TSessionGroup[];
}): string[] =>
  result.filteredGroups.flatMap((group) =>
    group.items.map((item) => item.session.id),
  );

describe('useSessionFilters — restauración desde la URL (FR-013, FR-014)', () => {
  it('reads projects and range from the initial URL and applies them', () => {
    const { result } = renderFilters(groups, [
      urlWith({
        [FILTER_PARAM_KEYS.projects]: '/repo/beta',
        [FILTER_PARAM_KEYS.range]: '24h',
      }),
    ]);

    expect(result.current.selectedProjects).toEqual(['/repo/beta']);
    expect(result.current.validSelected).toEqual(['/repo/beta']);
    expect(result.current.range).toBe('24h');
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filteredGroups.map((group) => group.directory)).toEqual(
      ['/repo/beta'],
    );
  });

  it('exposes the project catalog built from the unfiltered groups (FR-004)', () => {
    const { result } = renderFilters();

    expect(result.current.options).toEqual([
      {
        directory: '/repo/alpha',
        name: 'alpha',
        path: '/repo/alpha',
        count: 2,
      },
      {
        directory: '/repo/beta',
        name: 'beta',
        path: '/repo/beta',
        count: 1,
      },
      {
        directory: '/repo/gamma',
        name: 'gamma',
        path: '/repo/gamma',
        count: 1,
      },
    ]);
  });
});

describe('useSessionFilters — vacío = todos (FR-003, SC-004)', () => {
  it('defaults to no project filter and the "all" range', () => {
    const { result } = renderFilters();

    expect(result.current.selectedProjects).toEqual([]);
    expect(result.current.validSelected).toEqual([]);
    expect(result.current.range).toBe('all');
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.isEmptyResult).toBe(false);
  });

  it('returns the groups untouched when there are no active filters', () => {
    const { result } = renderFilters();

    expect(result.current.filteredGroups).toEqual(groups);
  });
});

describe('useSessionFilters — degradación tolerante (FR-015)', () => {
  it('falls back to "all" for an unknown range without throwing', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.range]: '90d' }),
    ]);

    expect(result.current.range).toBe('all');
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
  });

  it('ignores a project that no longer exists, showing everything', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.projects]: '/repo/missing' }),
    ]);

    // El valor crudo se conserva, pero la intersección vacía equivale a "todos".
    expect(result.current.selectedProjects).toEqual(['/repo/missing']);
    expect(result.current.validSelected).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
  });

  it('keeps the valid projects of a mixed selection', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.projects]: '/repo/alpha,/repo/missing' }),
    ]);

    expect(result.current.validSelected).toEqual(['/repo/alpha']);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filteredGroups.map((group) => group.directory)).toEqual(
      ['/repo/alpha'],
    );
  });

  it('combines an unknown project with an unknown range into "todos"', () => {
    const { result } = renderFilters(groups, [
      urlWith({
        [FILTER_PARAM_KEYS.projects]: '/repo/missing',
        [FILTER_PARAM_KEYS.range]: 'nope',
      }),
    ]);

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
  });
});

describe('useSessionFilters — toggleProject (FR-002, FR-003)', () => {
  it('marks a project and narrows the result to it', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.toggleProject('/repo/beta');
    });

    expect(result.current.selectedProjects).toEqual(['/repo/beta']);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filteredGroups.map((group) => group.directory)).toEqual(
      ['/repo/beta'],
    );
  });

  it('unmarks the last project and restores "todos" (FR-003)', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.projects]: '/repo/beta' }),
    ]);

    act(() => {
      result.current.toggleProject('/repo/beta');
    });

    expect(result.current.selectedProjects).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
  });

  it('supports multiselection while preserving the groups order (FR-020)', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.toggleProject('/repo/beta');
    });
    act(() => {
      result.current.toggleProject('/repo/alpha');
    });

    expect(result.current.selectedProjects).toEqual([
      '/repo/beta',
      '/repo/alpha',
    ]);
    expect(result.current.filteredGroups.map((group) => group.directory)).toEqual(
      ['/repo/alpha', '/repo/beta'],
    );
  });
});

describe('useSessionFilters — setRange (FR-008, FR-009)', () => {
  it('applies a bounded range over the last activity', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.setRange('1h');
    });

    expect(result.current.range).toBe('1h');
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filteredGroups.map((group) => group.directory)).toEqual(
      ['/repo/alpha', '/repo/beta'],
    );
    expect(visibleSessionIds(result.current)).toEqual([
      'alpha-recent',
      'beta-recent',
    ]);
  });

  it('returns to "all" and drops the range param when set back to default', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.range]: '24h' }),
    ]);

    act(() => {
      result.current.setRange('all');
    });

    expect(result.current.range).toBe('all');
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
    expect(lastSearch).not.toContain(FILTER_PARAM_KEYS.range);
  });
});

describe('useSessionFilters — isEmptyResult (FR-011, FR-017)', () => {
  it('reports an empty result when the intersection yields no sessions', () => {
    const { result } = renderFilters(groups, [
      urlWith({
        [FILTER_PARAM_KEYS.projects]: '/repo/gamma',
        [FILTER_PARAM_KEYS.range]: '1h',
      }),
    ]);

    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filteredGroups).toEqual([]);
    expect(result.current.isEmptyResult).toBe(true);
  });

  it('does not report an empty result without active filters', () => {
    const { result } = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.projects]: '/repo/missing' }),
    ]);

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.isEmptyResult).toBe(false);
  });
});

describe('useSessionFilters — clearFilters (FR-012, FR-013)', () => {
  it('removes both filter params and restores the full list', () => {
    const { result } = renderFilters(groups, [
      urlWith({
        [FILTER_PARAM_KEYS.projects]: '/repo/beta',
        [FILTER_PARAM_KEYS.range]: '24h',
      }),
    ]);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.selectedProjects).toEqual([]);
    expect(result.current.range).toBe('all');
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredGroups).toEqual(groups);
  });

  it('never clears unrelated URL params (does not use clearParams)', () => {
    const { result } = renderFilters(groups, [
      urlWith({
        [FILTER_PARAM_KEYS.projects]: '/repo/beta',
        [FILTER_PARAM_KEYS.range]: '24h',
        keep: '1',
      }),
    ]);

    act(() => {
      result.current.clearFilters();
    });

    expect(lastSearch).toContain('keep=1');
    expect(lastSearch).not.toContain(FILTER_PARAM_KEYS.projects);
    expect(lastSearch).not.toContain(FILTER_PARAM_KEYS.range);
  });
});

describe('useSessionFilters — recomposición en vivo (FR-022, SC-007)', () => {
  /** Instante congelado con `vi.setSystemTime` para la ventana rodante. */
  const FROZEN = new Date('2026-06-01T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops a session that crosses the 24h boundary as time advances', () => {
    const boundaryGroups = buildSessionGroups([
      {
        directory: '/repo/alpha',
        sessions: [
          { id: 'fresh', updated: FROZEN - 1_000 },
          { id: 'about-to-expire', updated: FROZEN - 24 * HOUR_MS + 500 },
        ],
      },
    ]);

    const { result } = renderFilters(boundaryGroups, [
      urlWith({ [FILTER_PARAM_KEYS.range]: '24h' }),
    ]);

    expect(visibleSessionIds(result.current)).toEqual([
      'fresh',
      'about-to-expire',
    ]);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(visibleSessionIds(result.current)).toEqual(['fresh']);
  });

  it('ticks only while a bounded range is active, and cleans up on unmount', () => {
    const bounded = renderFilters(groups, [
      urlWith({ [FILTER_PARAM_KEYS.range]: '1h' }),
    ]);
    expect(vi.getTimerCount()).toBe(1);

    bounded.unmount();
    expect(vi.getTimerCount()).toBe(0);

    const unbounded = renderFilters(groups);
    expect(vi.getTimerCount()).toBe(0);

    unbounded.unmount();
  });
});
