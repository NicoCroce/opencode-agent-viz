import { describe, expect, it } from 'vitest';
import type { SessionInfo } from '@opencode/client';
import { filterSubtree } from '../filterSubtree';
import { filterSubtree as filterSubtreeFromBarrel } from '../../Hooks';
import { session } from './fixtures';

/**
 * Spec de `filterSubtree` (feature 011, research R12, contrato
 * `contracts/subtree-structure-contract.md` §3 y criterio S7).
 *
 * `filterSubtree` ya **no** es el origen estructural del grafo (FR-013: lo es
 * `loadSubtree`), pero se conserva como función pura y API pública del barrel.
 * Este spec congela su comportamiento tal como está hoy:
 *  - `rootId` falsy (`null`/`''`) → `[]` sin recorrer nada;
 *  - BFS descendente por `parentID` con índice `Map`: la raíz primero y cada
 *    padre antes que sus hijas, con el orden de hermanas dado por el orden de
 *    entrada (determinista, independiente de que las hijas precedan al padre);
 *  - solo descendientes: las raíces ajenas y los ancestros quedan fuera;
 *    arrancar en una sesión no raíz devuelve su subárbol, no el del ancestro;
 *  - datos inconsistentes (id repetido, hija que apunta a un ancestro ya visto,
 *    `parentID` colgante) no cuelgan ni duplican: guarda anti-ciclo `seen` y
 *    `byId` con la primera aparición;
 *  - `parentID` ausente ⇒ la sesión nunca entra como hija (nodo raíz/legacy);
 *  - no muta la entrada y devuelve las **mismas** instancias del SDK.
 *
 * Los fixtures declaran la forma de `SessionInfo` sin redefinirla (Principio IV)
 * y las aserciones de orden se apoyan en el BFS (no en el orden alfabético).
 */

/** Subárbol canónico: `R → {A, B}`; `A → {A1, A2}`. */
const canonical = (): SessionInfo[] => [
  session('R'),
  session('A', { parentID: 'R' }),
  session('B', { parentID: 'R' }),
  session('A1', { parentID: 'A' }),
  session('A2', { parentID: 'A' }),
];

const ids = (values: readonly SessionInfo[]): string[] =>
  values.map((value) => value.id).sort();

/** Índice por id para comprobar la regla "el padre precede a sus hijas". */
const indexById = (values: readonly SessionInfo[]): Map<string, number> =>
  new Map(values.map((value, index) => [value.id, index]));

describe('filterSubtree · guarda de raíz (R12)', () => {
  it('devuelve [] sin recorrer nada cuando rootId es null', () => {
    expect(filterSubtree(canonical(), null)).toEqual([]);
  });

  it('trata rootId vacío como ausencia de raíz', () => {
    expect(filterSubtree(canonical(), '')).toEqual([]);
  });

  it('devuelve [] cuando la raíz no está en la lista, aunque haya hijas colgando de su id', () => {
    const sessions = [
      session('A', { parentID: 'R' }),
      session('A1', { parentID: 'A' }),
    ];

    const result = filterSubtree(sessions, 'R');

    // La guarda anti-ciclo corta antes de encolar las hijas de un id sin nodo.
    expect(result).toEqual([]);
  });
});

describe('filterSubtree · BFS descendente por parentID', () => {
  it('emite la raíz primero y cada padre antes que sus hijas', () => {
    const result = filterSubtree(canonical(), 'R');

    expect(result.map((value) => value.id)).toEqual([
      'R',
      'A',
      'B',
      'A1',
      'A2',
    ]);
    const positions = indexById(result);
    for (const node of result) {
      if (node.parentID === undefined) continue;
      expect(positions.get(node.parentID)).toBeLessThan(
        positions.get(node.id) as number,
      );
    }
  });

  it('resuelve por índice: las hijas pueden preceder al padre en la entrada', () => {
    const reversed = [...canonical()].reverse();

    const result = filterSubtree(reversed, 'R');

    expect(result[0].id).toBe('R');
    expect(ids(result)).toEqual(['A', 'A1', 'A2', 'B', 'R']);
  });

  it('es determinista: dos llamadas con la misma entrada devuelven el mismo orden', () => {
    const sessions = canonical();

    expect(filterSubtree(sessions, 'R').map((value) => value.id)).toEqual(
      filterSubtree(sessions, 'R').map((value) => value.id),
    );
  });

  it('excluye las raíces ajenas y los ancestros', () => {
    const sessions = [
      ...canonical(),
      // Hermana fuera del subárbol: otra raíz del listado global.
      session('S'),
    ];

    expect(ids(filterSubtree(sessions, 'R'))).toEqual([
      'A',
      'A1',
      'A2',
      'B',
      'R',
    ]);
  });

  it('arrancando en una sesión no raíz devuelve su subárbol, no el del ancestro', () => {
    const result = filterSubtree(canonical(), 'A');

    expect(ids(result)).toEqual(['A', 'A1', 'A2']);
    expect(result[0].id).toBe('A');
  });

  it('ignora la sesión sin parentID que no es la raíz observada', () => {
    const sessions = [session('R'), session('X'), session('A', { parentID: 'R' })];

    expect(ids(filterSubtree(sessions, 'R'))).toEqual(['A', 'R']);
  });
});

describe('filterSubtree · datos inconsistentes (guarda anti-ciclo)', () => {
  it('no vuelve a recorrer una hija que apunta a un ancestro ya visto', () => {
    const sessions = [
      ...canonical(),
      // Dato legacy: A1 lista a A, que ya está en el recorrido.
      session('A', { parentID: 'A1' }),
    ];

    const result = filterSubtree(sessions, 'R');

    expect(result.map((value) => value.id)).toEqual([
      'R',
      'A',
      'B',
      'A1',
      'A2',
    ]);
  });

  it('no cuelga cuando la raíz se declara hija de sí misma', () => {
    const sessions = [session('R', { parentID: 'R' })];

    expect(filterSubtree(sessions, 'R').map((value) => value.id)).toEqual(['R']);
  });

  it('deduplica el id repetido: gana la primera aparición del listado', () => {
    const sessions = [
      session('R'),
      session('X', { parentID: 'R' }),
      session('X', { parentID: 'R', title: 'duplicada' }),
    ];

    const result = filterSubtree(sessions, 'R');

    expect(result.map((value) => value.id)).toEqual(['R', 'X']);
    expect(result[1]).toBe(sessions[1]);
    expect(result[1].title).toBe('tarea X');
  });

  it('incluye una sola vez el id alcanzable desde dos padres', () => {
    const sessions = [
      session('R'),
      session('A', { parentID: 'R' }),
      session('B', { parentID: 'R' }),
      session('D', { parentID: 'A' }),
      session('D', { parentID: 'B' }),
    ];

    const result = filterSubtree(sessions, 'R');

    expect(ids(result)).toEqual(['A', 'B', 'D', 'R']);
    expect(result.filter((value) => value.id === 'D')).toHaveLength(1);
  });

  it('nunca incluye una sesión cuyo parentID apunta a un nodo desconocido', () => {
    const sessions = [
      session('R'),
      session('A', { parentID: 'R' }),
      session('orphan', { parentID: 'ghost' }),
    ];

    expect(ids(filterSubtree(sessions, 'R'))).toEqual(['A', 'R']);
  });
});

describe('filterSubtree · pureza', () => {
  it('no muta la entrada ni clona las sesiones del SDK', () => {
    const sessions = canonical();
    const snapshot = sessions.map((value) => value.id);

    const result = filterSubtree(sessions, 'R');

    expect(sessions.map((value) => value.id)).toEqual(snapshot);
    expect(result[0]).toBe(sessions[0]);
  });
});

describe('filterSubtree · API pública del barrel (R12, S7)', () => {
  it('el barrel de Hooks sigue reexportando la misma función', () => {
    expect(filterSubtreeFromBarrel).toBe(filterSubtree);
    expect(filterSubtreeFromBarrel(canonical(), 'R')).toHaveLength(
      canonical().length,
    );
  });
});
