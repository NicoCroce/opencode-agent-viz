import { describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '@opencode/client';
import {
  LOAD_CHUNK_SIZE,
  chunkLoadPlan,
  orderSubtreeForLoad,
  type TLoadOptions,
} from '../loadPriority';
import { session } from './fixtures';

/**
 * Spec del contrato de carga (feature 006), criterios L1..L3 de
 * `contracts/graph-loading-contract.md` §2.
 *
 * `loadPriority.ts` lo implementa T016; hasta entonces este spec falla al
 * resolver el import (ROJO esperado). Describe el comportamiento congelado:
 *  - L1: `orderSubtreeForLoad` respeta el orden 1→5 y es determinista.
 *  - L2: `skippedIds` = intersección del subárbol con `readyIds`.
 *  - L3: `chunkLoadPlan` sin pérdidas ni duplicados; `size <= 0` → `1`.
 *
 * Los fixtures usan una ventana de ejecución holgada (`updated = created + 1000`)
 * para que los hermanos se solapen y formen una misma tanda de ejecución, con lo
 * que el "nivel de ejecución" coincide con la profundidad del árbol y el orden
 * esperado es independiente de si la implementación replica el agrupamiento de
 * `deriveExecutionLevels` o hace un BFS por profundidad.
 */

/**
 * Sesión de prueba con `parentID` y ventana de ejecución determinista. Pasa
 * `parentID` como `undefined` para construir una raíz.
 */
const makeSession = (
  id: string,
  parentID: string | undefined,
  created: number,
): SessionInfo =>
  session(id, { parentID, time: { created, updated: created + 1_000 } });

/** Subárbol canónico: R → {A, B}; A → {A1, A2}. */
const tree = (): SessionInfo[] => [
  makeSession('R', undefined, 0),
  makeSession('A', 'R', 100),
  makeSession('B', 'R', 150),
  makeSession('A1', 'A', 250),
  makeSession('A2', 'A', 300),
];

const options = (overrides: Partial<TLoadOptions> = {}): TLoadOptions => ({
  rootId: 'R',
  selectedId: null,
  activeIds: new Set<string>(),
  readyIds: new Set<string>(),
  ...overrides,
});

const subtreeIds = (subtree: readonly SessionInfo[]): string[] =>
  subtree.map((item) => item.id).sort();

describe('orderSubtreeForLoad · L1 (orden 1→5 determinista)', () => {
  it('coloca la raíz primero aunque no encabece la entrada (regla 1)', () => {
    const plan = orderSubtreeForLoad([...tree()].reverse(), options());

    expect(plan.orderedIds[0]).toBe('R');
    expect(plan.orderedIds).toHaveLength(tree().length);
  });

  it('ordena por nivel de ejecución y, dentro del nivel, por time.created (regla 4)', () => {
    const plan = orderSubtreeForLoad(tree(), options());

    expect(plan.orderedIds).toEqual(['R', 'A', 'B', 'A1', 'A2']);
  });

  it('adelanta los nodos activos antes del resto (regla 3)', () => {
    const plan = orderSubtreeForLoad(
      tree(),
      options({ activeIds: new Set(['A2']) }),
    );

    expect(plan.orderedIds).toEqual(['R', 'A2', 'A', 'B', 'A1']);
  });

  it('adelanta los ancestros del nodo seleccionado (regla 2)', () => {
    const subtree = [
      makeSession('R', undefined, 0),
      makeSession('A', 'R', 150),
      makeSession('B', 'R', 100),
      makeSession('A1', 'A', 250),
    ];

    const plan = orderSubtreeForLoad(subtree, options({ selectedId: 'A1' }));

    // A es ancestro del seleccionado; sin la regla 2 iría tras B (created menor).
    expect(plan.orderedIds.indexOf('A')).toBeLessThan(
      plan.orderedIds.indexOf('B'),
    );
  });

  it('adelanta los descendientes directos del nodo seleccionado (regla 2)', () => {
    const subtree = [
      makeSession('R', undefined, 0),
      makeSession('A', 'R', 100),
      makeSession('B', 'R', 150),
      makeSession('A1', 'A', 250),
    ];

    const plan = orderSubtreeForLoad(subtree, options({ selectedId: 'A' }));

    // A1 es descendiente directo de A; sin la regla 2 iría tras B (nivel menor).
    expect(plan.orderedIds.indexOf('A1')).toBeLessThan(
      plan.orderedIds.indexOf('B'),
    );
  });

  it('respeta el orden de arriba hacia abajo en la cadena de ancestros (regla 2)', () => {
    const chain = [
      makeSession('R', undefined, 0),
      makeSession('A', 'R', 10),
      makeSession('B', 'A', 20),
      makeSession('C', 'B', 30),
    ];

    const plan = orderSubtreeForLoad(chain, options({ selectedId: 'C' }));

    expect(plan.orderedIds).toEqual(['R', 'A', 'B', 'C']);
  });

  it('desempata por id lexicográfico cuando coinciden nivel y tiempo (regla 5)', () => {
    const tied = [
      makeSession('R', undefined, 0),
      makeSession('B', 'R', 100),
      makeSession('A', 'R', 100),
    ];

    const plan = orderSubtreeForLoad(tied, options());

    expect(plan.orderedIds).toEqual(['R', 'A', 'B']);
  });

  it('es determinista y no depende del reloj', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
      const first = orderSubtreeForLoad(tree(), options({ selectedId: 'A1' }));

      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      const second = orderSubtreeForLoad(tree(), options({ selectedId: 'A1' }));

      expect(second).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('orderSubtreeForLoad · L2 (skippedIds = readyIds ∩ subárbol)', () => {
  it('excluye de orderedIds los ids ya ready y los reporta en skippedIds', () => {
    const plan = orderSubtreeForLoad(
      tree(),
      options({ readyIds: new Set(['A', 'A2', 'externa']) }),
    );

    expect([...plan.skippedIds].sort()).toEqual(['A', 'A2']);
    expect(plan.orderedIds).toEqual(['R', 'B', 'A1']);
  });

  it('orderedIds y skippedIds no se solapan y cubren todo el subárbol', () => {
    const plan = orderSubtreeForLoad(
      tree(),
      options({ readyIds: new Set(['A', 'A2', 'externa']) }),
    );

    const ordered = new Set(plan.orderedIds);
    for (const id of plan.skippedIds) {
      expect(ordered.has(id)).toBe(false);
    }
    expect([...plan.orderedIds, ...plan.skippedIds].sort()).toEqual(
      subtreeIds(tree()),
    );
  });
});

describe('chunkLoadPlan · L3 (sin pérdidas ni duplicados)', () => {
  it('expone LOAD_CHUNK_SIZE = 8', () => {
    expect(LOAD_CHUNK_SIZE).toBe(8);
  });

  it('trocea respetando el tamaño y sin perder ni duplicar ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    const chunks = chunkLoadPlan(ids, 2);

    expect(chunks).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(chunks.flat()).toEqual(ids);
    expect(new Set(chunks.flat()).size).toBe(ids.length);
  });

  it('devuelve [] para una entrada vacía', () => {
    expect(chunkLoadPlan([], 8)).toEqual([]);
  });

  it('normaliza size <= 0 a 1', () => {
    expect(chunkLoadPlan(['a', 'b', 'c'], 0)).toEqual([['a'], ['b'], ['c']]);
    expect(chunkLoadPlan(['a', 'b'], -5)).toEqual([['a'], ['b']]);
  });

  it('trocea con LOAD_CHUNK_SIZE sin pérdidas ni duplicados', () => {
    const ids = Array.from(
      { length: LOAD_CHUNK_SIZE + 2 },
      (_, index) => `id-${index}`,
    );

    const chunks = chunkLoadPlan(ids, LOAD_CHUNK_SIZE);

    expect(chunks.map((chunk) => chunk.length)).toEqual([LOAD_CHUNK_SIZE, 2]);
    expect(chunks.flat()).toEqual(ids);
  });

  it('no muta la entrada', () => {
    const ids = ['a', 'b', 'c'];
    const copy = [...ids];

    chunkLoadPlan(ids, 2);

    expect(ids).toEqual(copy);
  });
});
