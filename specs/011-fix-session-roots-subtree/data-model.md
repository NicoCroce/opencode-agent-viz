# Data Model — Raíces siempre listables, subárbol completo y paralelismo por invocación

**Feature**: `011-fix-session-roots-subtree` · **Date**: 2026-10-12
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

Este documento describe las **entidades de vista** que intervienen en la feature. No hay entidades de servidor nuevas: la app es de solo lectura (Principio I) y las entidades crudas siguen siendo tipos del SDK (`SessionInfo`, `SessionMessageInfo`, `SessionStatus`, `AgentInfo`, `InstructionEntryInfo`, `McpServer`), que **no se redefinen** (Principio IV). Convención de nombres `T` (AGENTS.md).

---

## 1. Sesión raíz listable — `TSessionGroup` / `TRootSessionItem`

**Estado**: existentes, se conservan (`Sessions/Hooks/useRootSessions.ts`).

| Campo | Tipo | Regla |
|---|---|---|
| `TRootSessionItem.session` | `TSession` (= `SessionInfo`) | sesión raíz; `parentID === undefined` |
| `TRootSessionItem.agentName` | `string \| null` | `session.agent ?? null` |
| `TSessionGroup.directory` | `string` | `session.location.directory` |
| `TSessionGroup.items` | `TRootSessionItem[]` | orden por `time.updated` **desc** dentro de la carpeta |

**Reglas de validación derivadas de FR-001/FR-002**
1. Solo entran sesiones con `parentID === undefined` (el filtro de cliente se **conserva** como defensa en profundidad si el server ignorara `parentID`).
2. Orden global por `time.updated` descendente; agrupación por `location.directory`.
3. El conjunto es **completo** o la carga declara `truncated` (tope 5.000 raíces por directorio).

## 2. Resultado de paginación de raíces

```ts
interface TRootSessionsResult {
  sessions: SessionInfo[];
  truncated: boolean;
}
```

- `truncated = true` ⟺ se alcanzó `SESSION_MAX_PAGES` con cursor todavía presente.
- Sin duplicados entre páginas (el cursor avanza); `order` solo en la primera página.

## 3. Subárbol de la sesión abierta — `TSubtreeLoadResult`

**Nuevo** (`Graph/lib/loadPlan/subtree.ts`). Sustituye a `filterSubtree(sessions.list, id)` como **origen estructural** (FR-013).

```ts
interface TSubtreeLoadResult {
  sessions: SessionInfo[];
  truncated: boolean;
  loadedCount: number;
  reason?: string;
  notFound?: boolean; // sesión inexistente (FR-005)
}
```

| Campo | Regla |
|---|---|
| `sessions` | raíz + todos los descendientes alcanzables, BFS por `parentID`, deduplicado (anti-ciclo) |
| `truncated` | `true` ⟺ se superó el **presupuesto global** de nodos/requests (no un tope por padre) |
| `loadedCount` | nº de sesiones cargadas; se expone para instrumentación (falta de medición por bloqueos) |
| `reason` | motivo del truncamiento (presupuesto de nodos / de requests / ciclo) |
| `notFound` | `true` cuando `session.get(id)` no devuelve sesión |

**Flujo**: `sessionId ∈ items` (todas las raíces tras E1) → fast path, 0 requests de subida; si es descendiente, subir con `ancestorChain` (`session.get` por cada ancestro) → BFS descendente con `listChildSessions` por nivel.

**Reglas**: bosque plano ⇒ 1 request por raíz; `parentID` ausente ignorado (nodo raíz interno/legacy); el presupuesto se consume por nodo cargado y por request emitido.

## 4. Invocación — `TInvocation`

**Nuevo** (`Graph/lib/invocations.ts`). Unidad de paralelismo (FR-007).

| Campo | Tipo | Origen |
|---|---|---|
| `sessionId` | `string \| null` | `state.metadata.sessionID` (100 % de los spawns medidos) |
| `stepId` | `string` | id del mensaje assistant que contiene la tool call |
| `startedAt` | `number` | `part.time.created` |
| `endedAt` | `number \| null` | `part.time.completed`; si `background`, `max(completed, fin hija)` (FR-016, 0 casos medidos) |
| `status` | `string` | `part.state.status` |
| `toolName` | `'subagent' \| 'task'` | `part.name` |

**Regla**: `SUBAGENT_TOOLS = { 'subagent', 'task' }` se **duplica** aquí desde `Inspector/lib/deriveTasks.ts:8` (Principio II) con comentario al origen.

## 5. Lote paralelo — `TParallelGroup` / `TInvocationBatch`

**Estado**: `TParallelGroup` existe (`Graph.entity.ts`); se añade `deriveInvocationBatches`.

```ts
interface TInvocationBatch {
  stepId: string;          // paso del padre que originó el lote
  parentId: string | null; // sesión padre (null en la raíz)
  sessionIds: string[];    // hijas invocadas en el paso (>= 2 = paralelo)
}
```

| Campo (`TParallelGroup`) | Regla |
|---|---|
| `id` | estable: `parentId#stepId` (invocación) o `parentId#firstNodeId` (respaldo sesión) |
| `parentId` | `string \| null` (raíz) |
| `nodeIds` | ids de nodo (únicos por sesión, aunque la sesión participe en varios lotes) |
| `startedAt` / `endedAt` | ventanas informativas del lote |

**Paridad fila ↔ badge (FR-008)**: `deriveExecutionLevels` (filas/carriles) y `parallelByNode` (badge) deben salir de la **misma** función de lotes. **La invocación gana** cuando existe; el solape por sesión de `deriveSiblingBatches` es el respaldo (FR-012). Un nodo reutilizado participa en **varios** lotes (FR-007).

**Firma de lotes en `deriveExecutionKey`** (FR-008): la clave incluye los ids y miembros de los lotes; sin esto el memo por clave no se invalida al llegar los mensajes del padre y E4 sería un no-op.

## 6. Skill cargada — `TSkillUsage`

**Nuevo** (`Inspector/lib/deriveSkills.ts`), extiende `TResourceUsage.skills` (FR-009).

| Campo | Tipo | Regla |
|---|---|---|
| `name` | `string` | `input.name` **o** `input.id` (ambas formas se usan) |
| `count` | `number` | nº de cargas de la skill (repeticiones incluidas) |
| `estTokens` | `number` \| `null` | caracteres ÷ 4 sobre `content[].text`; `null` si no disponible → la fila muestra solo el nombre |
| `firstLoadedAt` | `number` | `time.created` más bajo |

**Reglas de validación (FR-010)**
1. `estTokens` es **aproximado** (caracteres/4): la UI rota con `~` y el `aria-label` deletrea "aproximadamente"; **nunca** es métrica de coste real.
2. `state.status === 'error'` (p. ej. denegada por permisos) **no** cuenta como cargada.
3. Sesión sin skills → sección visible con **"Sin skills cargadas"**; la sección no queda oculta por el resto de secciones vacías.
4. Tools dicen "usadas"; Skills dicen "cargadas".

## 7. Aviso de truncamiento — `TTruncationNotice`

**Nuevo** (`Application/Components/Molecules/GraphTruncationBanner.tsx`).

| Propiedad | Regla (FR-002/FR-006, SC-009) |
|---|---|
| Contenido | **informativo puro**: sin cifras ("N de M") y sin acción |
| Rol | `role="status"`, `aria-live="polite"` (patrón `ConnectionBadge`; **no** `role="alert"`) |
| Presentación | `Alert` compartido, `variant="warning"`; entre cabecera y lienzo del grafo |
| Comportamiento | persiste mientras el resultado esté truncado; **no bloquea**: el grafo sigue usable; no se re-anuncia por tick |
| Disparadores | `truncated` del subárbol **o** del listado de raíces |

## 8. Estados de pantalla del grafo (Principio VI)

Transiciones explícitas (`useGraphModel` → `GraphPane`), sin skeleton terminal (FR-004/FR-005):

| Estado | Condición | Salida |
|---|---|---|
| error | `isError(estructura)` (fallo de la estructura; el fallo del directorio no entra aquí) | `EmptyScreenError` + reintento |
| loading acotado | `directorio pendiente \|\| isLoading(estructura)` | `GraphSkeleton` (acotado: termina al resolver o fallar, nunca terminal) |
| no encontrada | `notFound === true` (FR-005): irresoluble (el fallo del respaldo del directorio no se distingue de inexistente) o cargador que la declara no encontrada | `EmptyState` "no encontrada" + acción a `/sessions` (no terminal) |
| vacío | estructura resuelta y `nodes.length === 0` | `EmptyState` "sin agentes" |
| datos | estructura con nodos | `AgentGraph` (+ banner si `truncated`) |

## 9. Claves de caché afectadas — `queryKeys`

| Key | Forma | Nota |
|---|---|---|
| `sessions.roots(directory)` | `[...sessions.all, directory, 'roots']` | **nueva**; invalidada por prefijo de `sessions.all` (D3) |
| `sessions.children(parentID)` | `[...sessions.all, 'children', parentID]` | **nueva**; caché del BFS por padre |
| `sessions.list(directory)` | sin cambios | el grafo **deja de consumirla** (E2); el listado tampoco |
| key de respaldo del directorio | `['sessions', 'directory', id]` | `session.get`; `staleTime: Infinity` (por id, no por directory) |
| `sessions.messages(id)` | sin cambios | fuente de E4/E5; **ninguna** consulta nueva |
