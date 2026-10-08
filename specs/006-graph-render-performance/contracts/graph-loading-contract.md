# Contrato — Carga progresiva del subárbol

**Feature**: `006-graph-render-performance`
**Cubre**: FR-001, FR-002, FR-003, FR-004, FR-008, FR-009, FR-010 · SC-002, SC-003, SC-007, SC-008
**Implementa**: `Domains/Graph/Hooks/useGraphStructure.ts`, `Domains/Graph/Hooks/useGraphEnrichment.ts`,
`Domains/Graph/Hooks/useGraphModel.ts`, `Domains/Graph/lib/loadPriority.ts`, `Domains/Graph/lib/deriveMetrics.ts`.

---

## 1. Modelo por fases

`useGraphModel(sessionId, directory)` conserva **exactamente** la firma y la forma de retorno actuales:

```ts
interface UseGraphModelResult {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  executionPlan: TExecutionPlan;
  activeNodeId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
```

Internamente se compone de dos hooks (no exportados por el barrel):

### 1.1 `useGraphStructure(sessionId, directory)`

- **Entradas de red**: **ninguna nueva**. Solo lee consultas ya existentes:
  - `queryKeys.sessions.list(directory)` (ya cargada por el listado de sesiones),
  - `queryKeys.sessions.status()` (mapa global sembrado por `EventStreamProvider`),
  - `queryKeys.agents.list(directory)`.
- **Salida**: `TGraphModel` con nodos `enrichment: 'pending'` y `data.metrics = EMPTY_METRICS`, más `executionPlan` y layout derivados de `topologySignature`.
- **Estados en la fase de estructura**: solo son **definitivos** los estados derivables de `SessionStatus` (`running`, `retrying`, `created`); `compacting`, `waiting-permission`/`waiting-input` y los terminales (`succeeded`/`failed`/`interrupted`) requieren `compaction`/`outcome` (señal/log), formularios, permisos o `hasActivity` (mensajes) y quedan **provisionales** mientras `enrichment === 'pending'`, fijándose al enriquecer (ver [data-model.md](../data-model.md) §2.2). La paridad (FR-007) se contrasta **solo** con nodos `enrichment === 'ready'`.
- **Garantía**: disponible en el primer render en que las tres consultas anteriores tienen datos; **no** bloquea en mensajes/log/permisos/formularios/inbox.

### 1.2 `useGraphEnrichment(ids, structure)`

- Carga mensajes, permisos, log, señal en vivo, formularios y inbox para los ids del subárbol, **por lotes priorizados**, y fusiona el resultado en los nodos (`enrichment: 'ready'`).
- `structure` es el `TGraphModel` de la fase estructural: aporta la topología/ids a enriquecer y es la base sobre la que se escriben las métricas/estados finales.
- Escribe en las **mismas claves** que parchea `eventReducer` (no crea claves nuevas).
- **No** descarga el histórico completo de cada agente (eso es `History`, bajo demanda).

## 2. Plan de carga (puro)

### 2.1 `orderSubtreeForLoad(subtree, options)`

```ts
export interface TLoadOptions {
  rootId: string;
  selectedId: string | null;
  activeIds: ReadonlySet<string>;
  readyIds: ReadonlySet<string>;
}

export interface TLoadPlan {
  orderedIds: string[];
  skippedIds: string[];
}

export const orderSubtreeForLoad = (
  subtree: readonly SessionInfo[],
  options: TLoadOptions,
): TLoadPlan;
```

**Orden (estable y determinista)**:

1. `rootId` (si está en el subárbol).
2. **Ancestros** y **descendientes directos** del nodo seleccionado (`selectedId`), de arriba hacia abajo.
3. Nodos **activos** (`activeIds`, derivados de `isActiveStatus`) no incluidos antes.
4. Resto en **BFS por nivel de ejecución** (mismo agrupamiento por tanda que `deriveExecutionLevels`; dentro del nivel, por `time.created` ascendente).
5. Empate restante: `id` lexicográfico (garantiza orden total reproducible, sin depender de `Date.now()`).

`skippedIds`: ids presentes en `readyIds`; **no** se incluyen en `orderedIds` (SC-008, FR-004).

### 2.2 `chunkLoadPlan(orderedIds, size)`

```ts
export const chunkLoadPlan = (orderedIds: readonly string[], size: number): string[][];
```

- `size` por defecto: `LOAD_CHUNK_SIZE = 8` (constante exportada, ajustable).
- `size <= 0` se normaliza a `1`. Entrada vacía → `[]`. La concatenación de los chunks es `orderedIds` (sin pérdidas ni duplicados).

## 3. Procesamiento por lotes y cancelación

- `useGraphEnrichment` procesa **un lote por turno** (`requestIdleCallback` con fallback a `setTimeout`) para ceder el hilo y no congelar la UI (SC-007).
- Al cambiar `sessionId` o el conjunto de `ids`, el plan en vuelo se **reinicia**; los resultados de una sesión abandonada **igual se escriben en caché** (son válidos y reutilizables, FR-004) pero no bloquean ni se esperan para la sesión nueva.
- Un fallo de red de un lote deja esos nodos en `enrichment: 'pending'`; el estado de pantalla lo gobierna `sessionsQuery` (error→carga→vacío→datos, FR-008), sin bloqueo permanente.

## 4. Revisita y no-repetición

| Escenario | Contrato |
|-----------|----------|
| Primera visita a una sesión grande | `useGraphStructure` pinta de inmediato; `useGraphEnrichment` completa por lotes (FR-010). |
| Revisita en la misma sesión de trabajo | Estructura desde caché; el enriquecimiento de ids `ready` se salta (`skippedIds`) → sin recarga (FR-004, SC-003). |
| Cambio rápido entre sesiones | El trabajo de la sesión abandonada se descarta del plan activo y no degrada la elegida (edge case de la spec). |
| Sesión sin agentes | `graph.nodes.length === 0` → `EmptyState` actual, **sin** enriquecimiento (edge case "sesión sin agentes"). |
| Sesión en otro proyecto/directorio | La estructura se lee con la clave del `directory` correspondiente; no dispara recargas de subárboles ya resueltos (edge case). |

## 5. Qué preserva del comportamiento actual

- **Frescura ≤ 1 s** (FR-009): el enriquecimiento usa las mismas claves que `eventReducer`; los eventos siguen ganando (verificado por spec, L9). `useNow` solo se desactiva —tanto en el modelo como en el resumen de `WorkspacePage`, FR-024 de 003-execution-detail-views— cuando no hay ningún nodo activo (no afecta el dato mostrado).
- **Estados de pantalla** (FR-008): `useGraphModel.isLoading` es `true` mientras no haya estructura; después el `graphPane` ya no muestra el esqueleto. `isError`/`error` siguen viniendo de `sessionsQuery`.
- **Paridad** (FR-007): al terminar el enriquecimiento, el modelo es idéntico a la línea base (ver [graph-render-contract.md](./graph-render-contract.md) §4).

## 6. Criterios de aceptación del contrato

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| L1 | `orderSubtreeForLoad` respeta el orden 1→5 y es determinista | spec puro `loadPriority.spec.ts` |
| L2 | `skippedIds` = intersección con `readyIds` | spec puro |
| L3 | `chunkLoadPlan` sin pérdidas/duplicados; `size<=0` → 1 | spec puro |
| L4 | Estructura sin consultas nuevas de contenido | spec de `useGraphStructure` con `renderWithProviders` (spía de `opencodeService`: no llama a `getSessionMessages`/`getSessionLog`/etc.) |
| L5 | Enriquecimiento por lotes y `enrichment` `pending→ready` | spec de `useGraphEnrichment` (fake timers/idle) |
| L6 | Cambio de sesión reinicia el plan y no bloquea | spec de `useGraphEnrichment` con `rerender` |
| L7 | Revisita no repite carga | spec de `useGraphModel`/`useGraphEnrichment` (segunda visita: `skippedIds` completos) |
| L8 | API pública de `useGraphModel` sin cambios | spec de forma + compilación (`tsc`) |
| L9 | El enriquecimiento escribe en las **mismas claves** que `eventReducer` (frescura ≤ 1 s) | spec de `useGraphEnrichment` (mismas `queryKeys`; un evento en vivo posterior gana) |
