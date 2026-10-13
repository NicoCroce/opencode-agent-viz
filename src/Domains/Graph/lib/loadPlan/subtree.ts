import type { SessionInfo } from '@opencode/client';
import { ancestorChain } from './traversal';

/**
 * Presupuesto **global** de nodos por carga del subárbol (contrato de subárbol
 * §1, R5): alineado al techo de fluidez ~200 agentes de `006`. Es global por
 * carga y **no** un tope por padre (S6): un árbol ancho se corta y el corte se
 * **declara** (`truncated`/`reason`/`loadedCount`), nunca en silencio.
 */
export const SUBTREE_MAX_NODES = 200;

/** Motivo del corte por presupuesto de nodos (data-model §3, campo `reason`). */
export const SUBTREE_TRUNCATED_REASON =
  'presupuesto global de nodos del subárbol agotado';

/**
 * Resultado del cargador (contrato de subárbol §1, data-model §3): raíz +
 * descendientes alcanzables deduplicados, el corte declarado y la marca de
 * "sesión inexistente" (FR-005).
 */
export interface TSubtreeLoadResult {
  sessions: SessionInfo[];
  /** `true` ⟺ se superó el presupuesto global (nunca un tope por padre). */
  truncated: boolean;
  /** Nº de sesiones cargadas (instrumentación: falta de medición por bloqueos). */
  loadedCount: number;
  /** Motivo del truncamiento (presupuesto de nodos / de requests / ciclo). */
  reason?: string;
  /** `true` cuando la sesión abierta no existe (FR-005). */
  notFound?: boolean;
}

/** Dependencias inyectadas: el cargador es puro y no conoce el SDK. */
export interface TSubtreeLoadInput {
  sessionId: string;
  /** Todas las raíces del proyecto (tras E1: `listRootSessions`). */
  roots: readonly SessionInfo[];
  /** Sesión por id; el servicio **propaga** el error del SDK si no existe. */
  getSession: (id: string) => Promise<SessionInfo>;
  /** Hijas directas de una sesión, ya resueltas (`listChildSessions`). */
  listChildren: (parentID: string) => Promise<SessionInfo[]>;
}

const notFoundResult = (): TSubtreeLoadResult => ({
  sessions: [],
  truncated: false,
  loadedCount: 0,
  notFound: true,
});

/**
 * Raíz del subárbol de `sessionId`: fast path si ya está entre las raíces
 * (0 requests de subida) y, si es descendiente, subida por `parentID` con
 * `ancestorChain` (`traversal.ts`) pidiendo con `getSession` solo los ancestros
 * que no conocemos (los que están en `roots` no cuestan red).
 *
 * Devuelve `null` cuando la **sesión abierta** no existe: el servicio propaga el
 * error del SDK y aquí —y solo aquí— se traduce a "no encontrada" (FR-005). Un
 * fallo al resolver un ancestro se propaga como error (no es un 404 de la sesión
 * abierta y no debe disfrazarse de "no encontrada").
 */
const resolveRoot = async (
  sessionId: string,
  byId: Map<string, SessionInfo>,
  getSession: TSubtreeLoadInput['getSession'],
): Promise<SessionInfo | null> => {
  if (!byId.has(sessionId)) {
    try {
      const fetched = await getSession(sessionId);
      byId.set(fetched.id, fetched);
    } catch {
      return null;
    }
  }

  // El ancestro conocido más alto: `ancestorChain` arranca por el id y sube
  // mientras los ancestros estén en el mapa, así que el primer eslabón que sí
  // conocemos es la cima visible del árbol.
  const topmostKnown = (): SessionInfo | undefined =>
    ancestorChain(sessionId, byId)
      .map((id) => byId.get(id))
      .find((session) => session !== undefined);

  let top = topmostKnown();
  const guarded = new Set<string>();
  while (
    top !== undefined &&
    top.parentID !== undefined &&
    !guarded.has(top.id)
  ) {
    guarded.add(top.id);
    const parent = await getSession(top.parentID);
    byId.set(parent.id, parent);
    top = topmostKnown();
  }
  return top ?? null;
};

/**
 * Cargador puro del subárbol de una sesión (contrato de subárbol §1/§2,
 * FR-003/FR-005/FR-006/FR-013): sustituye a `filterSubtree(sessions.list, id)`
 * como **origen estructural** y descubre a los descendientes con una consulta
 * por nodo visitado (`listChildren`), no filtrando una lista plana — así un hijo
 * que quedó fuera de la primera página de las raíces entra igual (S1).
 *
 * BFS **por nivel** con `Promise.all`; guarda anti-ciclo y deduplicación
 * (precedente `filterSubtree`); las hijas sin `parentID` se ignoran (nodo raíz
 * interno/legacy); presupuesto global de nodos (S6).
 */
export const loadSubtree = async (
  input: TSubtreeLoadInput,
): Promise<TSubtreeLoadResult> => {
  const byId = new Map<string, SessionInfo>(
    input.roots.map((root) => [root.id, root]),
  );
  const root = await resolveRoot(input.sessionId, byId, input.getSession);
  if (root === null) return notFoundResult();

  const sessions: SessionInfo[] = [];
  const seen = new Set<string>([root.id]);
  let level: SessionInfo[] = [root];
  let truncated = false;
  let reason: string | undefined;

  while (level.length > 0) {
    const room = SUBTREE_MAX_NODES - sessions.length;
    if (room <= 0) {
      truncated = true;
      reason = SUBTREE_TRUNCATED_REASON;
      break;
    }
    const expanded = level.slice(0, room);
    if (expanded.length < level.length) {
      truncated = true;
      reason = SUBTREE_TRUNCATED_REASON;
    }
    sessions.push(...expanded);

    // Una consulta por nodo expandido, también las hojas: solo la consulta
    // revela que no tienen hijas. En paralelo **por nivel**.
    const childrenByNode = await Promise.all(
      expanded.map((node) => input.listChildren(node.id)),
    );

    const next: SessionInfo[] = [];
    for (const children of childrenByNode) {
      for (const child of children) {
        // Nodo raíz interno/legacy: no pertenece a este subárbol.
        if (child.parentID === undefined) continue;
        // Anti-ciclo + deduplicación: un nodo se recorre una sola vez, aunque
        // dos padres lo listen o apunte a un ancestro ya visto.
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        next.push(child);
      }
    }

    if (truncated) break;
    level = next;
  }

  return {
    sessions,
    truncated,
    loadedCount: sessions.length,
    reason,
    notFound: false,
  };
};
