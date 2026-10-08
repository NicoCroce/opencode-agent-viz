import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_RANGE,
  FILTER_PARAM_KEYS,
  TIME_RANGES,
  buildProjectOptions,
  filterGroups,
  isWithinTimeRange,
  parseProjects,
  parseTimeRange,
  serializeProjects,
  serializeRange,
} from '../sessionFilters';
import {
  buildSessionGroup,
  buildSessionGroups,
} from '../../specs/fixtures';

/**
 * Specs de la lógica pura de filtros (feature 005).
 *
 * Contrato congelado: `specs/005-session-filters/contracts/session-filters-contract.md`
 * §5 (URL) y §6 (reglas puras). No dependen del reloj real: `now` siempre se
 * inyecta, de modo que la ventana rodante (FR-022) es determinista.
 */

/** Instante de referencia para la evaluación de rango. */
const NOW = 10_000_000;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

describe('sessionFilters — constantes', () => {
  it('exposes the five predefined ranges with `all` as default', () => {
    expect(TIME_RANGES.map((option) => option.value)).toEqual([
      '1h',
      '24h',
      '7d',
      '30d',
      'all',
    ]);
    expect(DEFAULT_TIME_RANGE).toBe('all');
    expect(TIME_RANGES.find((option) => option.value === 'all')?.durationMs).toBe(
      null,
    );
  });

  it('uses stable, non-magic URL parameter names', () => {
    expect(FILTER_PARAM_KEYS).toEqual({ projects: 'projects', range: 'range' });
  });
});

describe('sessionFilters — URL: projects (FR-013..FR-015)', () => {
  it('round-trips directories through serialize + parse', () => {
    const directories = ['/Users/dev/alpha', '/Users/dev/beta project'];

    expect(parseProjects(serializeProjects(directories))).toEqual(directories);
  });

  it('keeps a comma inside a directory distinct from the list separator', () => {
    const directories = ['/repo/a,b', '/repo/c'];

    const serialized = serializeProjects(directories);

    expect(serialized).not.toContain('/repo/a,b');
    expect(parseProjects(serialized)).toEqual(directories);
  });

  it('serializes an empty selection to undefined so the param is dropped', () => {
    expect(serializeProjects([])).toBeUndefined();
  });

  it('parses absent or empty input as "todos" ([] = all, FR-003)', () => {
    expect(parseProjects(undefined)).toEqual([]);
    expect(parseProjects(null)).toEqual([]);
    expect(parseProjects('')).toEqual([]);
  });

  it('discards empty segments from the serialized list (FR-015)', () => {
    expect(parseProjects('a,,b,')).toEqual(['a', 'b']);
  });

  it('degrades tolerantly on a malformed percent escape without throwing', () => {
    expect(() => parseProjects('bad%zz,ok')).not.toThrow();
    expect(parseProjects('bad%zz,ok')).toEqual(['bad%zz', 'ok']);
  });

  it('decodes URL-encoded segments back to their original value', () => {
    expect(parseProjects('%2FUsers%2Fdev%2Falpha')).toEqual([
      '/Users/dev/alpha',
    ]);
  });
});

describe('sessionFilters — URL: range (FR-008, FR-013, FR-015)', () => {
  it.each(['1h', '24h', '7d', '30d', 'all'] as const)(
    'parses the known range %s verbatim',
    (range) => {
      expect(parseTimeRange(range)).toBe(range);
    },
  );

  it('degrades unknown or missing values to the default "all"', () => {
    expect(parseTimeRange('90d')).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange('')).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange(null)).toBe(DEFAULT_TIME_RANGE);
    expect(parseTimeRange(undefined)).toBe(DEFAULT_TIME_RANGE);
  });

  it('serializes "all" to undefined and keeps any bounded range', () => {
    expect(serializeRange('all')).toBeUndefined();
    expect(serializeRange('24h')).toBe('24h');
  });

  it('round-trips every bounded range through serialize + parse', () => {
    const bounded = TIME_RANGES.map((option) => option.value).filter(
      (value) => value !== DEFAULT_TIME_RANGE,
    );

    for (const range of bounded) {
      expect(parseTimeRange(serializeRange(range))).toBe(range);
    }
  });
});

describe('sessionFilters — isWithinTimeRange (FR-009, FR-022)', () => {
  it('always accepts anything for the "all" range, even a missing timestamp', () => {
    expect(isWithinTimeRange(NOW, 'all', NOW)).toBe(true);
    expect(isWithinTimeRange(null, 'all', NOW)).toBe(true);
    expect(isWithinTimeRange(undefined, 'all', NOW)).toBe(true);
    expect(isWithinTimeRange(NaN, 'all', NOW)).toBe(true);
  });

  it('rejects a non-finite timestamp for any bounded range', () => {
    expect(isWithinTimeRange(null, '1h', NOW)).toBe(false);
    expect(isWithinTimeRange(undefined, '24h', NOW)).toBe(false);
    expect(isWithinTimeRange(NaN, '7d', NOW)).toBe(false);
  });

  it('includes the exact boundary (now - updated === duration)', () => {
    expect(isWithinTimeRange(NOW - HOUR_MS, '1h', NOW)).toBe(true);
  });

  it('excludes a session one millisecond past the boundary', () => {
    expect(isWithinTimeRange(NOW - HOUR_MS - 1, '1h', NOW)).toBe(false);
  });

  it('evaluates each range against its own duration', () => {
    expect(isWithinTimeRange(NOW - DAY_MS, '24h', NOW)).toBe(true);
    expect(isWithinTimeRange(NOW - DAY_MS - 1, '24h', NOW)).toBe(false);
    expect(isWithinTimeRange(NOW - DAY_MS, '1h', NOW)).toBe(false);
  });

  it('keeps a session whose activity is in the future within the window', () => {
    expect(isWithinTimeRange(NOW + HOUR_MS, '1h', NOW)).toBe(true);
  });
});

describe('sessionFilters — filterGroups (FR-003, FR-005, FR-010, FR-017, FR-020)', () => {
  const groups = buildSessionGroups([
    {
      directory: '/repo/alpha',
      sessions: [
        { id: 'alpha-recent', updated: NOW - 10_000 },
        { id: 'alpha-old', updated: NOW - 10 * DAY_MS },
      ],
    },
    {
      directory: '/repo/beta',
      sessions: [{ id: 'beta-recent', updated: NOW - 20_000 }],
    },
  ]);

  it('returns the input untouched when there are no active filters (SC-004)', () => {
    const result = filterGroups(groups, {
      directories: [],
      range: 'all',
      now: NOW,
    });

    expect(result).toEqual(groups);
    expect(result.map((group) => group.directory)).toEqual([
      '/repo/alpha',
      '/repo/beta',
    ]);
  });

  it('keeps only the selected projects and drops the other groups whole (FR-005)', () => {
    const result = filterGroups(groups, {
      directories: ['/repo/beta'],
      range: 'all',
      now: NOW,
    });

    expect(result.map((group) => group.directory)).toEqual(['/repo/beta']);
  });

  it('applies the project × range intersection, not a union (FR-010)', () => {
    const result = filterGroups(groups, {
      directories: ['/repo/alpha'],
      range: '24h',
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].directory).toBe('/repo/alpha');
    expect(result[0].items.map((item) => item.session.id)).toEqual([
      'alpha-recent',
    ]);
  });

  it('discards a group left without items, header included (FR-017)', () => {
    const result = filterGroups(groups, {
      directories: [],
      range: '1h',
      now: NOW,
    });

    expect(result.map((group) => group.directory)).toEqual(['/repo/alpha', '/repo/beta']);
    expect(result.every((group) => group.items.length > 0)).toBe(true);
  });

  it('drops groups that are empty in the input', () => {
    const withEmpty = buildSessionGroups([
      { directory: '/repo/empty', sessions: [] },
      { directory: '/repo/alpha', sessions: [{ id: 'a', updated: NOW }] },
    ]);

    const result = filterGroups(withEmpty, {
      directories: [],
      range: 'all',
      now: NOW,
    });

    expect(result.map((group) => group.directory)).toEqual(['/repo/alpha']);
  });

  it('preserves the order of groups and of items within a group (FR-020)', () => {
    const ordered = buildSessionGroups([
      {
        directory: '/repo/first',
        sessions: [
          { id: 'f1', updated: NOW },
          { id: 'f2', updated: NOW - 1_000 },
        ],
      },
      { directory: '/repo/second', sessions: [{ id: 's1', updated: NOW }] },
    ]);

    const result = filterGroups(ordered, {
      directories: [],
      range: 'all',
      now: NOW,
    });

    expect(result.map((group) => group.directory)).toEqual([
      '/repo/first',
      '/repo/second',
    ]);
    expect(result[0].items.map((item) => item.session.id)).toEqual(['f1', 'f2']);
  });

  it('yields no groups when a selected directory matches nothing', () => {
    const result = filterGroups(groups, {
      directories: ['/repo/missing'],
      range: 'all',
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('does not mutate the input groups', () => {
    const snapshot = structuredClone(groups);

    filterGroups(groups, { directories: ['/repo/alpha'], range: '1h', now: NOW });

    expect(groups).toEqual(snapshot);
  });
});

describe('sessionFilters — buildProjectOptions (FR-004, FR-023)', () => {
  it('skips projects without sessions, so there are no empty options', () => {
    const groups = buildSessionGroups([
      { directory: '/repo/empty', sessions: [] },
      { directory: '/repo/alpha', sessions: [{ id: 'a1' }, { id: 'a2' }] },
    ]);

    const options = buildProjectOptions(groups);

    expect(options).toHaveLength(1);
    expect(options[0].directory).toBe('/repo/alpha');
  });

  it('derives name from folderName and keeps the full path as secondary text', () => {
    const groups = buildSessionGroups([
      { directory: '/Users/dev/my-project/', sessions: [{ id: 'a1' }] },
    ]);

    expect(buildProjectOptions(groups)).toEqual([
      {
        directory: '/Users/dev/my-project/',
        name: 'my-project',
        path: '/Users/dev/my-project/',
        count: 1,
      },
    ]);
  });

  it('counts the sessions of the unfiltered catalog and preserves order', () => {
    const groups = buildSessionGroups([
      { directory: '/repo/alpha', sessions: [{ id: 'a1' }, { id: 'a2' }] },
      { directory: '/repo/beta', sessions: [{ id: 'b1' }] },
    ]);

    const options = buildProjectOptions(groups);

    expect(options.map((option) => option.directory)).toEqual([
      '/repo/alpha',
      '/repo/beta',
    ]);
    expect(options.map((option) => option.count)).toEqual([2, 1]);
  });

  it('distinguishes homonymous folders by their full path (SC-008)', () => {
    const groups = buildSessionGroups([
      { directory: '/repo-a/app', sessions: [{ id: 'x' }] },
      { directory: '/repo-b/app', sessions: [{ id: 'y' }] },
    ]);

    const options = buildProjectOptions(groups);

    expect(options.map((option) => option.name)).toEqual(['app', 'app']);
    expect(options.map((option) => option.path)).toEqual([
      '/repo-a/app',
      '/repo-b/app',
    ]);
  });

  it('returns an empty catalog when there are no groups', () => {
    expect(buildProjectOptions([])).toEqual([]);
    expect(buildProjectOptions([buildSessionGroup({ directory: '/repo/x' })])).toEqual(
      [],
    );
  });
});
