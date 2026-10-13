import { describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '@opencode/client';
import { loadSubtree } from '../loadPlan/subtree';
import { session } from './fixtures';

/**
 * Spec del cargador puro del subárbol (feature 011, contrato
 * `contracts/subtree-structure-contract.md` §1, data-model §3; cubre S1/S2/S6).
 *
 * `loadPlan/subtree.ts` lo implementa T020 (ola posterior): hasta entonces este
 * spec falla al resolver el import (**ROJO esperado**, T015 → T020). Congela el
 * comportamiento acordado:
 *  - descendientes descubiertos con `listChildren`, **una consulta por nodo
 *    visitado** (no filtrando una lista plana): un hijo fuera de la primera
 *    página de las raíces entra igual;
 *  - `sessionId ∈ roots` → **fast path**: 0 requests de subida (`getSession`);
 *    un bosque plano cuesta 1 request por raíz;
 *  - sesión abierta descendiente → subir con `ancestorChain` (`getSession`) y
 *    bajar con BFS **desde la raíz** (entran las ramas hermanas);
 *  - presupuesto **global** de nodos/requests (alineado al techo ~200 de 006):
 *    al agotarse, `truncated = true` + `reason` + `loadedCount`, nunca recorte
 *    silencioso ni tope por padre (S6);
 *  - guarda anti-ciclo y deduplicación (precedente `filterSubtree.ts`), `parentID`
 *    ausente ignorado y sesión inexistente → `notFound` con `sessions: []`.
 *
 * Los fixtures declaran la forma del SDK sin redefinirla (Principio IV) y las
 * aserciones sobre el orden de `sessions` son por conjunto ordenado: el contrato
 * no fija el orden de salida.
 */

type TResult = Awaited<ReturnType<typeof loadSubtree>>;

/**
 * Almacén perezoso de sesiones: declara la forma del árbol una sola vez y sirve
 * las lecturas como lo haría el servicio (`session.get` por id rechaza si la
 * sesión no existe; `session.list({ parentID })` devuelve solo las hijas
 * directas, ya resueltas).
 */
const createStore = () => {
  const nodes = new Map<string, SessionInfo>();
  const childrenOf = new Map<string, string[]>();

  const add = (
    id: string,
    parentID: string | undefined,
    childIds: readonly string[] = [],
  ): string => {
    nodes.set(id, session(id, { parentID }));
    childrenOf.set(id, [...childIds]);
    return id;
  };

  const setChildren = (parentID: string, childIds: readonly string[]) => {
    childrenOf.set(parentID, [...childIds]);
  };

  const node = (id: string): SessionInfo => {
    const found = nodes.get(id);
    if (!found) throw new Error(`fixture sin sesión "${id}"`);
    return found;
  };

  const getSession = vi.fn((id: string): Promise<SessionInfo> => {
    const found = nodes.get(id);
    // El servicio real rechaza ante una sesión inexistente (session.service.ts).
    if (!found) return Promise.reject(new Error(`session not found: ${id}`));
    return Promise.resolve(found);
  });

  const listChildren = vi.fn((parentID: string): Promise<SessionInfo[]> =>
    Promise.resolve(
      (childrenOf.get(parentID) ?? [])
        .map((childId) => nodes.get(childId))
        .filter((child): child is SessionInfo => child !== undefined),
    ),
  );

  return { add, setChildren, node, getSession, listChildren };
};

type TStore = ReturnType<typeof createStore>;

const load = (
  store: TStore,
  input: { sessionId: string; rootIds: readonly string[] },
): Promise<TResult> =>
  loadSubtree({
    sessionId: input.sessionId,
    roots: input.rootIds.map((id) => store.node(id)),
    getSession: store.getSession,
    listChildren: store.listChildren,
  });

const ids = (values: readonly SessionInfo[]): string[] =>
  values.map((value) => value.id).sort();

/** ids pedidos a `listChildren`, en orden de llamada (una por nodo interno). */
const childCalls = (store: TStore): string[] =>
  store.listChildren.mock.calls.map(([parentID]) => parentID);

const sessionCalls = (store: TStore): string[] =>
  store.getSession.mock.calls.map(([id]) => id);

/**
 * Árbol regular `breadth^depth` (raíz incluida), declarado en el almacén y
 * devuelto con el total de nodos. El tope por padre es `breadth`, así que sirve
 * para distinguir un presupuesto **global** de un tope por padre (S6).
 */
const seedTree = (
  store: TStore,
  breadth: number,
  depth: number,
): { rootId: string; total: number } => {
  const rootId = store.add('R0', undefined, []);
  let total = 1;
  let frontier = [rootId];
  for (let level = 1; level <= depth; level += 1) {
    const next: string[] = [];
    for (const parentId of frontier) {
      const childIds: string[] = [];
      for (let index = 0; index < breadth; index += 1) {
        const childId = `${parentId}.${index}`;
        store.add(childId, parentId, []);
        childIds.push(childId);
        total += 1;
      }
      store.setChildren(parentId, childIds);
      next.push(...childIds);
    }
    frontier = next;
  }
  return { rootId, total };
};

/**
 * R ─ A ─ {A1, A2}
 *   └ B ─ C
 */
const seedCanonical = (store: TStore) => {
  store.add('A1', 'A', []);
  store.add('A2', 'A', []);
  store.add('C', 'B', []);
  store.add('A', 'R', ['A1', 'A2']);
  store.add('B', 'R', ['C']);
  store.add('R', undefined, ['A', 'B']);
};

describe('loadSubtree — subárbol completo con hijos fuera de la primera página (S1, FR-013)', () => {
  it('descubre a los descendientes con una consulta por nodo interno', async () => {
    const store = createStore();
    seedCanonical(store);

    const result = await load(store, { sessionId: 'R', rootIds: ['R'] });

    expect(ids(result.sessions)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'R']);
    expect(result.truncated).toBe(false);
    expect(result.loadedCount).toBe(6);
    expect(result.notFound).toBeFalsy();
    // Una consulta por nodo visitado (también las hojas: solo la consulta revela
    // que no tienen hijas). El hijo C está fuera de la página de raíces: solo se
    // ve bajando por B.
    expect(childCalls(store).sort()).toEqual(ids(result.sessions));
  });

  it('no incluye ramas ajenas a la sesión abierta: bosque plano, 1 request por raíz', async () => {
    const store = createStore();
    store.add('R2', undefined, []);
    store.add('R1', undefined, []);

    const result = await load(store, { sessionId: 'R1', rootIds: ['R1', 'R2'] });

    expect(ids(result.sessions)).toEqual(['R1']);
    expect(result.truncated).toBe(false);
    expect(result.loadedCount).toBe(1);
    expect(childCalls(store)).toEqual(['R1']);
    // Fast path: la raíz ya viene del listado, no se sube con `session.get`.
    expect(store.getSession).not.toHaveBeenCalled();
  });
});

describe('loadSubtree — subida al ancestro raíz (S2, FR-003)', () => {
  it('sube por los ancestros y baja desde la raíz, incluidas las ramas hermanas', async () => {
    const store = createStore();
    seedCanonical(store);

    const result = await load(store, { sessionId: 'A1', rootIds: ['R'] });

    expect(ids(result.sessions)).toEqual(['A', 'A1', 'A2', 'B', 'C', 'R']);
    expect(result.truncated).toBe(false);
    expect(result.notFound).toBeFalsy();
    expect(sessionCalls(store)).toContain('A1');
    // La rama B solo entra si la subida llega hasta R antes del BFS.
    expect(ids(result.sessions)).toContain('B');
    expect(childCalls(store).sort()).toEqual(ids(result.sessions));
  });
});

describe('loadSubtree — presupuesto global de nodos/requests (S6, FR-006)', () => {
  it('trunca por presupuesto global, nunca por un tope por padre', async () => {
    const store = createStore();
    const { rootId, total } = seedTree(store, 12, 3);

    const result = await load(store, { sessionId: rootId, rootIds: [rootId] });

    // 12 hijas por padre: cualquier tope "por padre" dejaría pasar el árbol.
    expect(total).toBe(1 + 12 + 144 + 1_728);
    expect(result.truncated).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.loadedCount).toBeGreaterThan(0);
    expect(result.loadedCount).toBeLessThan(total);
    expect(result.sessions.length).toBeLessThan(total);
    expect(result.notFound).toBeFalsy();
    const calls = childCalls(store);
    // Nunca dos consultas por el mismo padre: el BFS no re-encola nodos vistos.
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.length).toBeGreaterThanOrEqual(result.loadedCount);
  });

  it('no trunca cuando el subárbol cabe en el presupuesto', async () => {
    const store = createStore();
    const { rootId, total } = seedTree(store, 3, 3);

    const result = await load(store, { sessionId: rootId, rootIds: [rootId] });

    expect(total).toBe(40);
    expect(result.truncated).toBe(false);
    expect(result.loadedCount).toBe(40);
    expect(result.sessions).toHaveLength(40);
    expect(result.reason).toBeFalsy();
  });
});

describe('loadSubtree — guarda anti-ciclo y deduplicación (filterSubtree.ts:28)', () => {
  it('no vuelve a recorrer una hija que apunta a un ancestro ya visto', async () => {
    const store = createStore();
    store.add('B', 'A', []);
    store.add('A', 'R', ['B']);
    store.add('R', undefined, ['A']);
    // Dato inconsistente (legacy): B lista a A, que ya está en el recorrido.
    store.setChildren('B', ['A']);

    const result = await load(store, { sessionId: 'R', rootIds: ['R'] });

    expect(ids(result.sessions)).toEqual(['A', 'B', 'R']);
    expect(result.loadedCount).toBe(3);
    expect(result.truncated).toBe(false);
    const calls = childCalls(store);
    expect(calls.sort()).toEqual(['A', 'B', 'R']);
  });

  it('deduplica un nodo listado como hija por dos padres', async () => {
    const store = createStore();
    store.add('D', 'A', []);
    store.add('A', 'R', ['D']);
    store.add('B', 'R', ['D']);
    store.add('R', undefined, ['A', 'B']);

    const result = await load(store, { sessionId: 'R', rootIds: ['R'] });

    expect(ids(result.sessions)).toEqual(['A', 'B', 'D', 'R']);
    expect(result.loadedCount).toBe(4);
    expect(childCalls(store).sort()).toEqual(['A', 'B', 'D', 'R']);
  });

  it('ignora la hija que llega sin parentID (nodo raíz interno/legacy)', async () => {
    const store = createStore();
    store.add('X', undefined, []);
    store.add('R', undefined, ['X']);

    const result = await load(store, { sessionId: 'R', rootIds: ['R'] });

    expect(ids(result.sessions)).toEqual(['R']);
    expect(result.loadedCount).toBe(1);
    expect(result.truncated).toBe(false);
  });
});

describe('loadSubtree — sesión inexistente (FR-005)', () => {
  it('declara notFound sin recorrer ni truncar cuando la sesión no existe', async () => {
    const store = createStore();
    store.add('R', undefined, []);

    const result = await load(store, { sessionId: 'ghost', rootIds: ['R'] });

    expect(result.notFound).toBe(true);
    expect(result.sessions).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(store.listChildren).not.toHaveBeenCalled();
  });
});
