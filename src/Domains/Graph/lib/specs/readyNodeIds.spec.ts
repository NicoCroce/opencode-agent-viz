import { describe, expect, it, vi } from 'vitest';
import { collectReadyIds } from '../readyNodeIds';

/**
 * Spec de `collectReadyIds` (feature 012, T024, contrato
 * `contracts/enrichment-pure-api.md` §3, research D2 y criterio FR-011).
 *
 * Congela la semántica de `readyIds` al extraerla del `useMemo` inline de
 * `useGraphEnrichment`:
 *  - resultado = `{ id ∈ ids : hasMessages(id) } ∪ enriched`;
 *  - **nuevo** `Set`: nunca devuelve `enriched` ni muta las entradas;
 *  - el predicado se inyecta (no abre consultas) y se evalúa una vez por cada
 *    id de `ids`, en ese orden, aunque el id ya esté en `enriched`;
 *  - la pertenencia se decide por valor: un id cacheado no se repite.
 *
 * El predicado es el equivalente puro de
 * `queryClient.getQueryData(queryKeys.sessions.messages(id)) !== undefined`.
 */

const idsOf = (ready: ReadonlySet<string>): string[] =>
  [...ready].sort((a, b) => a.localeCompare(b));

describe('collectReadyIds · unión de enriquecido y caché (FR-011)', () => {
  it('une los ids cacheados a los ya enriquecidos', () => {
    const enriched = new Set(['A']);

    const ready = collectReadyIds(['A', 'B', 'C'], enriched, (id) =>
      id === 'B' || id === 'C',
    );

    expect(idsOf(ready)).toEqual(['A', 'B', 'C']);
  });

  it('sin caché devuelve exactamente lo enriquecido', () => {
    const enriched = new Set(['A', 'B']);

    const ready = collectReadyIds(['A', 'B', 'C'], enriched, () => false);

    expect(idsOf(ready)).toEqual(['A', 'B']);
  });

  it('sin enriquecido devuelve exactamente lo cacheado', () => {
    const ready = collectReadyIds(['A', 'B', 'C'], new Set<string>(), (id) =>
      id === 'C',
    );

    expect(idsOf(ready)).toEqual(['C']);
  });

  it('no incluye ids fuera de `ids` aunque el predicado los acepte', () => {
    const ready = collectReadyIds(['A'], new Set<string>(), (id) =>
      id === 'A' || id === 'Z',
    );

    expect(ready.has('Z')).toBe(false);
    expect(idsOf(ready)).toEqual(['A']);
  });

  it('con `ids` vacío devuelve una copia de `enriched`', () => {
    const ready = collectReadyIds([], new Set(['A']), () => true);

    expect(idsOf(ready)).toEqual(['A']);
  });
});

describe('collectReadyIds · un id listo no se repite', () => {
  it('deduplica el id cacheado repetido dentro de `ids`', () => {
    const ready = collectReadyIds(['A', 'B', 'A', 'B'], new Set<string>(), () =>
      true,
    );

    expect(ready.size).toBe(2);
    expect(idsOf(ready)).toEqual(['A', 'B']);
  });

  it('deja una sola entrada cuando el id está en `enriched` y además cacheado', () => {
    const enriched = new Set(['A']);

    const ready = collectReadyIds(['A'], enriched, () => true);

    expect(ready.size).toBe(1);
    expect(idsOf(ready)).toEqual(['A']);
  });

  it('reconoce el id enriquecido por valor, no por identidad de referencia', () => {
    const ready = collectReadyIds(
      ['A', 'B'],
      new Set(['A']),
      (id) => id !== 'B',
    );

    expect(ready.has('A')).toBe(true);
    expect(ready.has('B')).toBe(false);
  });
});

describe('collectReadyIds · el predicado decide, sin abrir consultas', () => {
  it('invoca el predicado una vez por id y en el orden de `ids`', () => {
    const hasMessages = vi.fn((_id: string) => true);

    collectReadyIds(['A', 'B', 'A'], new Set<string>(), hasMessages);

    expect(hasMessages).toHaveBeenCalledTimes(3);
    expect(hasMessages.mock.calls.map(([id]) => id)).toEqual(['A', 'B', 'A']);
  });

  it('evalúa el predicado también para los ids ya enriquecidos', () => {
    const hasMessages = vi.fn((_id: string) => false);

    collectReadyIds(['A'], new Set(['A']), hasMessages);

    expect(hasMessages).toHaveBeenCalledTimes(1);
    expect(hasMessages).toHaveBeenCalledWith('A');
  });

  it('no consulta nada cuando no hay ids que comprobar', () => {
    const hasMessages = vi.fn((_id: string) => true);

    const ready = collectReadyIds([], new Set(['A']), hasMessages);

    expect(hasMessages).not.toHaveBeenCalled();
    expect(idsOf(ready)).toEqual(['A']);
  });

  it('no exige que el predicado sea estable: cada llamada se usa tal cual', () => {
    let calls = 0;
    const ready = collectReadyIds(['A', 'B'], new Set<string>(), () => {
      calls += 1;
      return calls === 1;
    });

    expect(idsOf(ready)).toEqual(['A']);
  });
});

describe('collectReadyIds · pureza (FR-013)', () => {
  it('devuelve un `Set` nuevo, nunca `enriched`', () => {
    const enriched = new Set(['A']);

    const ready = collectReadyIds(['A'], enriched, () => true);

    expect(ready).toBeInstanceOf(Set);
    expect(ready).not.toBe(enriched);
  });

  it('no muta `enriched` ni `ids`', () => {
    const enriched = new Set(['A']);
    const ids = ['A', 'B'];
    const enrichedSnapshot = [...enriched];
    const idsSnapshot = [...ids];

    collectReadyIds(ids, enriched, () => true);

    expect([...enriched]).toEqual(enrichedSnapshot);
    expect(ids).toEqual(idsSnapshot);
  });

  it('es determinista: la misma entrada produce el mismo conjunto', () => {
    const enriched = new Set(['A']);
    const hasMessages = (id: string): boolean => id === 'B';

    const first = collectReadyIds(['A', 'B'], enriched, hasMessages);
    const second = collectReadyIds(['A', 'B'], enriched, hasMessages);

    expect(idsOf(first)).toEqual(idsOf(second));
    expect(first).not.toBe(second);
  });
});
