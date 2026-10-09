# Data Model — Live Node Feedback, Effort Levels & Detail Panel UX

**Feature**: `008-node-effort-inspector-ux`
**Date**: 2026-10-09
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [design-direction.md](./design-direction.md)

Este documento describe las **entidades de vista** que introducen o precisan las seis mejoras. **No hay entidades de servidor nuevas** (regla de solo lectura, Principio I). Los datos crudos siguen siendo tipos del SDK (`FileDiffInfo`, `SessionInfo`, `SessionStatus`, `V2Event`) y **no se redefinen** (Principio IV). Convención de nombres: prefijo `T` para tipos de vista (`AGENTS.md`, `Graph.entity.ts`).

---

## 1. Entidades de dominio (ya existen; se precisan)

### 1.1 Nodo de agente (`TGraphNodeData`) — se añade un campo
Campos relevantes para las mejoras (sin cambio de significado):

| Campo | Tipo | Origen |
|-------|------|--------|
| `status` | `TNodeStatus` | activo = `isActiveStatus`; señaliza la animación (FR-001) |
| `metrics.durationMs` | `number \| null` | duración viva (tick) o cerrada; entra en el esfuerzo relativo |
| `metrics.startedAt` | `number \| null` | orden de "más reciente" del follow |
| `createdAt` | `number \| null` | fallback de `startOf` del follow; orden de línea |
| `parallel` | `TNodeParallelism \| null` | badge; **no** es lo mismo que "lanza paralelos" |
| `effort` | `TNodeEffort \| null` | **NUEVO**: nivel de esfuerzo de vista (§2.1) |

**Cambio**: se **añade** `effort`. La forma del resto no cambia. Debe entrar en `sameNodeData` (comparador `sameEffort`, §4).

### 1.2 Sesión (`SessionInfo`) — reutilizada, sin cambios
Aporta `time.created/updated/idle`, `parentID`, `location.directory`.

### 1.3 Grupo de paralelismo (`TParallelGroup`) — sin cambios de forma
`{ id, parentId, nodeIds, startedAt, endedAt }`. Se usa `parentId` para decidir si un nodo **lanza** paralelos (es padre de un grupo de 2+).

### 1.4 Plan de líneas (`TExecutionPlan`) — sin cambios de forma
`{ levels, levelByNode, columnByNode, width }`. `levels[]` = **tandas de ejecución**; es la definición de "misma línea" (FR-023).

### 1.5 Cambio de archivo (`TFileChange`) — sin cambios (alias del SDK)
`type TFileChange = FileDiffInfo` → `{ file, patch, additions, deletions, status }`. `status ∈ added|modified|deleted`. `patch` puede venir vacío.

---

## 2. Entidades nuevas / precisadas

### 2.1 Nivel de esfuerzo (`TNodeEffort`)

| Campo | Tipo | Regla |
|-------|------|-------|
| `level` | `1 \| 2 \| 3 \| 4 \| 5` | Base 1 + condiciones cumplidas (+1 paralelos, +1 tiempo, +2 forma: hijos e invocaciones), con tope 5 (`EFFORT_MAX`); el nivel 5 es alcanzable. |
| `provisional` | `boolean` | `true` si el nodo o algún nodo de su **línea** está activo (FR-028). |
| `reasons` | `string[]` | Motivos legibles; alimentan la descripción accesible (FR-026). |

- **Derivación**: `deriveEffortByNode(model, plan, parallelGroups)` (pura). Ver §3 reglas.
- **Campo opcional** (`effort?`): el modelo estructural no lo inicializa; lo puebla la derivación (memo final de `useGraphModel`, R4), igual que `enrichment?`. Así no rompe constructores ni fixtures existentes.
- **Solo lectura** (FR-027): no editable, no interactivo.
- **Origen de vista**: se adjunta al nodo en el memo final de `useGraphModel` (R4); no se persiste ni se envía.
- **Constantes**: `EFFORT_MAX = 5`, `EFFORT_SHAPE_CHILDREN = 3`, `EFFORT_SHAPE_INVOCATIONS = 5` en `lib/effort/constants.ts`.
- **Comparador**: `sameEffort(a, b)` compara `level`, `provisional` y `sameStringArray(a.reasons, b.reasons)`.

### 2.2 Nodo activo más reciente (`latestActiveNodeId: string | null`)

- Salida pura de `latestActiveNodeId(model)`: entre los nodos `isActiveStatus`, el de mayor `activityStartOf(node) = metrics.startedAt ?? createdAt ?? 0` (inicio de ejecución, con la creación de la sesión solo como fallback); helper propio y **distinto** del `startOf` de `nodeInterval.ts` (precedencia inversa); desempate por `id`. `null` si no hay activos.
- Se **añade** a `UseGraphModelResult` (additivo). `activeNodeId` (primer activo) se conserva.
- Consumo: `useFollowMode(latestActiveNodeId)` en `WorkspacePage`; `FollowController` centra el viewport (sin cambio de firma).

### 2.3 Estado de señal de actividad (CSS)

- Un `boolean` derivado (`isActiveStatus(status)` y no rayado por loop/reintento) decide la clase `.rail-scan` en `NodeStatusRail`. **No es entidad de datos**: es una clase de presentación; el estado real es `TNodeStatus`.

### 2.4 Hunk de diff (`TDiffHunk`) y línea de diff (`TDiffLine`)

| `TDiffLine` | Tipo | Regla |
|-------------|------|-------|
| `kind` | `'added' \| 'removed' \| 'context' \| 'meta'` | `meta` = cabeceras internas y `\ No newline at end of file` |
| `content` | `string` | Texto sin el prefijo `+`/`-`/` ` |
| `oldNumber` | `number \| null` | Número en el archivo viejo; `null` en añadidas/meta |
| `newNumber` | `number \| null` | Número en el archivo nuevo; `null` en eliminadas/meta |

| `TDiffHunk` | Tipo | Regla |
|-------------|------|-------|
| `header` | `string` | `@@ -a,b +c,d @@` (se conserva para mostrar) |
| `oldStart` / `oldCount` | `number` | Rango viejo; `count` por defecto 1 si se omite |
| `newStart` / `newCount` | `number` | Rango nuevo |
| `lines` | `TDiffLine[]` | Líneas del bloque, con numeración incremental |

- **Derivación**: `parseUnifiedDiff(patch)` (pura); `patch` vacío → `[]`.
- **Estado de colapso**: estado local de `FileDiff` (set de `header`/índice colapsado); **por defecto expandido** (FR-017). No es entidad de datos.
- **Estado del archivo**: `TFileChange.status` (ya existe) se muestra como punto LED; no se añade campo.

### 2.5 Estado del panel de detalle (`TInspectorPanelState`)

| Campo | Tipo | Persistencia | Regla |
|-------|------|--------------|-------|
| `width` | `number` | **Sí** (`localStorage`) | Acotado por `clampPanelWidth` a `[MIN, MAX]`; fallback `DEFAULT`. |
| `isResizing` | `boolean` | No | Feedback visual del separador (`--status-running`). |
| `isFullscreen` | `boolean` | **No** | Arranca `false`; se pierde al recargar (FR-013). |

- **Derivación**: hook `useInspectorPanel`; clamp puro `clampPanelWidth(value)` en `Application/Helpers/panelWidth.ts`.
- **Constantes**: `INSPECTOR_MIN_WIDTH`, `INSPECTOR_MAX_WIDTH`, `INSPECTOR_DEFAULT_WIDTH = 360`, `INSPECTOR_STEP`.

---

## 3. Reglas de validación / invariantes

1. **Esfuerzo acumulativo (FR-022, FR-024, FR-025)**: `level = min(5, 1 + [lanza paralelos] + [duración > 2× el más rápido de su línea] + [hijos ≥ umbral] + [invocaciones ≥ umbral])`. Nunca por debajo de 1 ni por encima de 5; el nivel 5 se alcanza con todas las condiciones.
2. **Línea = tanda (FR-023)**: la comparación de duración usa el nivel de `deriveExecutionLevels`, no el padre directo ni el grupo de paralelismo.
3. **Línea de uno (edge)**: el más rápido es el propio nodo → la condición relativa no suma.
4. **Duración ausente (edge)**: no penaliza; la condición relativa solo aplica con un mínimo válido `> 0`; todo nodo recibe al menos el nivel base 1 y nunca queda indefinido.
5. **Provisional (FR-028)**: `provisional` mientras la línea tenga algún activo; al cerrarse los tiempos se recalcula y pasa a final.
6. **Solo lectura (FR-027)**: `TNodeEffort` es informativo; el medidor no es un control interactivo.
7. **Esfuerzo visible sin re-layout (R4, SC-006)**: `effort` no entra en `deriveExecutionKey`; se deriva en el memo final y solo reconstruye el nodo cuando cambia.
8. **Comparador (recon)**: `effort` debe estar en `sameNodeData`; sin `sameEffort`, el medidor no se re-renderiza.
9. **Follow determinista (FR-005, FR-006)**: "más reciente" = mayor `startOf` con desempate por `id`; el viewport solo se mueve cuando cambia el **id** seguido.
10. **Follow sin activos (FR-007)** y **eventos sin cambio de activo (FR-009)**: no mueven el viewport.
11. **Animación solo en activos (FR-001, FR-004)**: la clase de barrido se aplica únicamente a `isActiveStatus` y no rayado; se retira al dejar de estar activo (FR-002).
12. **Movimiento reducido (FR-003)**: con `prefers-reduced-motion` el rail queda sólido y estático.
13. **Clamp del ancho (FR-011)**: `clampPanelWidth` sanea `NaN` y acota a `[MIN, MAX]`; el arranque desde `localStorage` también se acota.
14. **Ancho persistido / fullscreen efímero (FR-010, FR-013)**: solo `width` va a `localStorage`; `isFullscreen` arranca `false`.
15. **Resize no altera contenido (FR-012)**: cambiar el ancho no toca el grafo ni el contenido del panel.
16. **Fullscreen conserva estados (FR-014)**: se reutiliza el mismo `InspectorPanel` (error→carga→vacío→datos intactos).
17. **Fullscreen cierra con botón y Escape (FR-015)**.
18. **Diff seguro (FR-020)**: patch vacío → "parche no disponible"; no textual o inesperado → no rompe; sin salto final → `meta`; hunks expandidos por defecto (FR-017).
19. **Numeración doble (FR-018)**: `oldNumber`/`newNumber` incrementales; `null` donde no aplica.
20. **Estados de archivo (FR-019)**: `added/modified/deleted` distinguibles (color/etiqueta ya existentes).

---

## 4. Relaciones

```text
TGraphModel (enriquecido)
  ├── deriveExecutionLevels ──► TExecutionPlan.levels  ──┐  "línea" (tanda)
  ├── deriveParallelGroups ──► TParallelGroup.parentId ──┤
  ├── edges (hijos) + metrics.invocations ───────────────┤
  │                                                       ▼
  │                                       deriveEffortByNode ──► Record<id, TNodeEffort>
  │                                                       │
  └── nodos con duración viva (tick) ────────────────────►┘
                                        │
                                        ▼
                        useGraphModel.graph.nodes[].data.effort
                                        │  (solo reconstruye el nodo si cambia)
                                        ▼
                        AgentNode ──► AgentNodeHeader ──► EffortMeter (5 muescas)

TGraphModel.graph.nodes (isActiveStatus)
  └── latestActiveNodeId(model) ──► useFollowMode ──► followNodeId ──► FollowController.setCenter

TNodeStatus (isActiveStatus)
  └── NodeStatusRail(.rail-scan)  [animación CSS pura]

FileDiffInfo.patch (SDK)
  └── parseUnifiedDiff ──► TDiffHunk[] ──► FileDiff (canal doble, hunks colapsables) ◄── FileChanges

localStorage["inspector.panel.width"]
  └── useInspectorPanel ──► TInspectorPanelState { width, isResizing, isFullscreen }
        └── WorkspaceLayout (separador + overlay) ──► InspectorPanel (encabezado)
```

---

## 5. Qué NO cambia (fronteras del modelo)

- `TNodeStatus`, `TTokenUsage`, `TNodeMetrics`, `TExecutionSignal`, `TParallelGroup`, `TNodeSizeOverride`, `TGraphModel`, `TGraphNode`: **sin cambios de forma**.
- `TFileChange` sigue siendo **alias de `FileDiffInfo`** (Principio IV); no se redefinen tipos del SDK.
- `deriveExecutionKey`, `deriveExecutionLayout`, `deriveExecutionLevels`, `parallelism.ts`, el reducer de eventos y `EventStreamProvider`: **sin cambios** (salvo el ajuste de `STATUS_WIDTH` en `cardHeight`, que no es contrato de datos).
- Contrato de `reduceEvent`: **sin cambios**.
- Claves de consulta existentes: **sin cambios**; no se añade ninguna clave.
- Modelo de datos del servidor: fuera de alcance (solo lectura, Principio I).
