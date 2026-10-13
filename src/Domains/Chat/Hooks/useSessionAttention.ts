import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { FormInfo, PermissionRequest } from '@opencode/client';
import type { TGraphModel } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '../../queryKeys';
import { useCachedQueryData } from '../Chat.service';
import { deriveAttention } from '../lib/deriveAttention';
import type { TAttentionItem } from '../Chat.entity';

/**
 * `useSessionAttention(rootId, graph)` — **única fuente** de la atención de la
 * sesión abierta (FR-009/FR-011; `contracts/attention-contract.md §1`).
 *
 * Acota el grafo al **subárbol** de `rootId` (raíz + descendientes, siguiendo las
 * aristas padre→hijo del propio grafo) y delega la derivación en la función pura
 * `deriveAttention` (T048), cruzándola con la lista global `permissions.list()`
 * (que incluye los permisos de sesiones hijas, porque el evento trae su
 * `sessionID`). Devuelve `TAttentionItem[]` ordenado por `at`; sin pendientes en
 * el subárbol → `[]`.
 *
 * Los ítems de **pregunta** se enriquecen aquí con el `FormInfo` real cacheado
 * (`sessions.forms(id)`): `deriveAttention` no recibe formularios, así que por sí
 * sola cae al título del nodo y a un `id` estable por sesión. Este hook toma el
 * `id`/`title` del formulario cuando está disponible y mantiene ese respaldo
 * cuando aún no cargó. La firma de `deriveAttention` **no** cambia.
 */

/** Grafo vacío estable: evita recomputar la derivación sin `rootId`. */
const EMPTY_GRAPH: TGraphModel = { nodes: [], edges: [] };

/** Lista vacía estable mientras `permissions.list()` no está sembrada. */
const EMPTY_PERMISSIONS: PermissionRequest[] = [];

/**
 * BFS del subárbol de `rootId` (raíz + descendientes) sobre las aristas
 * padre→hijo (`source` = padre, `target` = hijo). Un `rootId` ausente del grafo
 * produce un grafo vacío.
 */
const filterSubtree = (graph: TGraphModel, rootId: string): TGraphModel => {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const included = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (included.has(id)) continue;
    if (!nodeById.has(id)) continue;
    included.add(id);
    for (const child of childrenByParent.get(id) ?? []) queue.push(child);
  }

  return {
    nodes: graph.nodes.filter((node) => included.has(node.id)),
    edges: graph.edges.filter(
      (edge) => included.has(edge.source) && included.has(edge.target),
    ),
  };
};

/** Lista vacía estable: `getQueryData` sin dato no debe producir otra referencia. */
const EMPTY_FORMS: FormInfo[] = [];

/** Formularios crudos cacheados de una sesión (`sessions.forms(id)`). */
const formsOf = (queryClient: QueryClient, sessionId: string): FormInfo[] =>
  queryClient.getQueryData<FormInfo[]>(queryKeys.sessions.forms(sessionId)) ??
  EMPTY_FORMS;

/**
 * Índice reactivo `sessionId → FormInfo[]` de los formularios cacheados del
 * subárbol. Se suscribe a la caché de `sessions.forms(id)` (el evento `form.*` la
 * escribe sin tocar el modelo del grafo) y cambia de identidad solo cuando esa
 * caché cambia, de modo que el ítem de pregunta se re-enriquece al llegar el
 * formulario.
 *
 * El índice es **referencialmente estable** (R2): `read()` conserva en un `useRef`
 * la última referencia y la devuelve tal cual si ninguna lista `FormInfo[]` por
 * sesión cambió, de modo que `setForms` no provoca render cuando el dato es el
 * mismo. Solo se construye un objeto nuevo si al menos una lista cambió.
 */
const useCachedForms = (sessionIds: string[]): Record<string, FormInfo[]> => {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(sessionIds);

  /** Snapshot puro de la caché: no memoiza identidad (valor inicial/lectura base). */
  const snapshot = useCallback((): Record<string, FormInfo[]> => {
    const result: Record<string, FormInfo[]> = {};
    for (const id of JSON.parse(serialized) as string[]) {
      result[id] = formsOf(queryClient, id);
    }
    return result;
  }, [queryClient, serialized]);

  const [forms, setForms] = useState(snapshot);
  const lastIndexRef = useRef(forms);

  /**
   * `read()` **referencialmente estable** (R2): devuelve la última referencia
   * producida tal cual cuando ninguna lista `FormInfo[]` por sesión cambió (así
   * `setForms` no provoca render) y solo construye un objeto nuevo si al menos
   * una lista cambió. Se invoca desde el efecto/notificaciones, nunca en render.
   */
  const read = useCallback((): Record<string, FormInfo[]> => {
    const ids = JSON.parse(serialized) as string[];
    const previous = lastIndexRef.current;

    if (
      Object.keys(previous).length === ids.length &&
      ids.every((id) => previous[id] === formsOf(queryClient, id))
    ) {
      return previous;
    }

    const next = snapshot();
    lastIndexRef.current = next;
    return next;
  }, [queryClient, serialized, snapshot]);

  useEffect(() => {
    const ids = new Set(JSON.parse(serialized) as string[]);
    const sync = () => setForms(read());
    sync();

    // El parámetro se tipa estructuralmente: solo se necesitan el `type` y la
    // `queryKey` del evento, y así la suscripción no depende de la unión de
    // eventos de la caché.
    type TQueryCacheEvent = {
      type?: string;
      query: { queryKey: readonly unknown[] };
    };

    return queryClient
      .getQueryCache()
      .subscribe((event: TQueryCacheEvent) => {
        // Solo eventos portadores de dato (R3): los estructurales del observador
        // (`observerOptionsUpdated`, `observerResultsUpdated`, `observer*`) no
        // cambian el dato y no deben disparar `sync()`.
        if (event.type !== 'updated') return;

        const key = event.query.queryKey;
        // Clave **exacta** `['sessions','forms',id]` (R1): no reaccionar a
        // `sessions.questions(id)` = `[...forms(id),'questions']`, cuyo prefijo
        // coincide con el de la clave de formularios crudos.
        if (
          key.length === 3 &&
          key[0] === 'sessions' &&
          key[1] === 'forms' &&
          ids.has(key[2] as string)
        ) {
          sync();
        }
      });
  }, [queryClient, serialized, read]);

  return forms;
};

/**
 * Enriquece los ítems de pregunta con el `FormInfo` real de su sesión de origen:
 * `id` y `title` salen del formulario cacheado; sin formulario se conserva el
 * `id`/`title` de `deriveAttention` (respaldo del título del nodo).
 */
const enrichQuestions = (
  items: TAttentionItem[],
  forms: Record<string, FormInfo[]>,
): TAttentionItem[] =>
  items.map((item) => {
    if (item.kind !== 'question') return item;
    const [form] = forms[item.sessionId] ?? [];
    if (!form) return item;
    return { ...item, id: form.id, title: form.title };
  });

export const useSessionAttention = (
  rootId: string | null,
  graph: TGraphModel,
): TAttentionItem[] => {
  const permissions =
    useCachedQueryData<PermissionRequest[]>(queryKeys.permissions.list()) ??
    EMPTY_PERMISSIONS;

  const subtree = useMemo(
    () => (rootId ? filterSubtree(graph, rootId) : EMPTY_GRAPH),
    [graph, rootId],
  );

  const baseItems = useMemo(
    () => deriveAttention(subtree, permissions),
    [subtree, permissions],
  );

  // Sesiones con pregunta pendiente: son las únicas cuyo formulario enriquece el
  // ítem; se firma su caché para re-enriquecer al llegar el `FormInfo`.
  const questionSessionIds = useMemo(
    () => [
      ...new Set(
        baseItems
          .filter((item) => item.kind === 'question')
          .map((item) => item.sessionId),
      ),
    ],
    [baseItems],
  );
  const forms = useCachedForms(questionSessionIds);

  return useMemo(() => enrichQuestions(baseItems, forms), [baseItems, forms]);
};
