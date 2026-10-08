# Data Model — Filtros de proyecto y recencia en el listado de sesiones

**Feature**: `005-session-filters`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [research.md](./research.md)

La spec lo dice explícitamente: **no introduce entidades de datos nuevas ni fuentes de datos nuevas** (Key Entities). Reutiliza las sesiones y los proyectos ya disponibles en el listado. Por tanto este documento describe (1) los datos reutilizados, (2) los **view-models de estado de vista** que la feature define y (3) las **reglas de filtrado** que determinan qué se ve.

---

## 1. Datos reutilizados (sin cambios)

Todos los tipos ya existen; no se añade, renombra ni redefine ninguno (Principio IV).

| Tipo | Origen | Campos usados por los filtros |
|------|--------|-------------------------------|
| `TSession` (= `SessionInfo`) | `@opencode/client` vía `Session.entity.ts` | `id`, `title`, `location.directory` (proyecto), `time.created`, **`time.updated`** (última actividad, FR-009) |
| `TRootSessionItem` | `useRootSessions.ts` | `{ session, agentName }` |
| `TSessionGroup` | `useRootSessions.ts` | `{ directory, items: TRootSessionItem[] }` — unidad del filtro de proyecto (FR-017) |
| `TProject` | `Projects.entity.ts` | Solo indirectamente: los directorios ya vienen resueltos en los `groups` |

**Conclusión**: no hay campos nuevos, ni reglas de validación de servidor nuevas, ni transiciones de estado. Los únicos modelos que añade la feature son de **presentación/estado de vista**.

---

## 2. View-models nuevos (estado de vista)

Viven en `src/Domains/Sessions/lib/sessionFilters.ts`. No son entidades de dominio del servidor; son tipos de UI/estado.

### 2.1 Rango temporal (`TTimeRange`)

```ts
export type TTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
```

| Valor | Etiqueta visible | `durationMs` |
|-------|------------------|--------------|
| `1h` | Última hora | 3 600 000 |
| `24h` | Últimas 24 horas | 86 400 000 |
| `7d` | Últimos 7 días | 604 800 000 |
| `30d` | Últimos 30 días | 2 592 000 000 |
| `all` | Todo | `null` (sin corte) |

- **Default**: `all` (FR-008).
- **Conjunto cerrado**: cualquier valor fuera de esta tabla se degrada a `all` (FR-015).
- Constante `TIME_RANGES` con `{ value, label, durationMs }[]` para alimentar el `Select`.

### 2.2 Opción de proyecto (`TProjectOption`)

```ts
export interface TProjectOption {
  directory: string;   // clave estable = group.directory (valor de URL)
  name: string;        // folderName(directory) — etiqueta principal (FR-023)
  path: string;        // ruta completa — texto secundario (FR-023)
  count: number;       // nº de sesiones del proyecto en el catálogo (sin filtrar)
}
```

- Se construye con `buildProjectOptions(groups)`, recorriendo los `groups` **sin filtrar** (FR-004: solo proyectos con al menos una sesión, sin opciones vacías).
- `name` se deriva con `folderName` de `@app/Application/Helpers`.

### 2.3 Selección de filtros (`TSessionFilters`)

```ts
export interface TSessionFilters {
  projects: string[];   // directorios marcados; [] = todos (FR-003)
  range: TTimeRange;    // default 'all' (FR-008)
}
```

Representa lo que la spec llama "Selección de filtros": el estado que se refleja en la dirección y determina qué grupos y sesiones son visibles.

---

## 3. Estado derivado (en `useSessionFilters`)

| Campo derivado | Tipo | Regla |
|----------------|------|-------|
| `selectedProjects` | `string[]` | `parseProjects(getParam('projects'))` |
| `range` | `TTimeRange` | `parseTimeRange(getParam('range'))` |
| `options` | `TProjectOption[]` | `buildProjectOptions(groups)` (catálogo sin filtrar) |
| `validSelected` | `string[]` | `selectedProjects ∩ options.directory`. Si queda vacío → se trata como "todos" (edge case proyecto inexistente, FR-003) |
| `hasActiveFilters` | `boolean` | `validSelected.length > 0 || range !== 'all'` |
| `filteredGroups` | `TSessionGroup[]` | Intersección proyecto × rango, con grupos vacíos descartados (FR-010, FR-017) |
| `isEmptyResult` | `boolean` | `filteredGroups.length === 0` (solo relevante con filtros activos) |
| `now` | `number` | `useNow(range !== 'all')` — reloj en vivo (FR-022) |

---

## 4. Reglas de filtrado (puras)

### 4.1 Evaluación de rango (FR-009, FR-022)

```ts
isWithinTimeRange(updatedAt: number | null | undefined, range: TTimeRange, now: number): boolean
```

1. `range === 'all'` → `true` (sin corte).
2. `updatedAt` no finito (`null`/`undefined`/`NaN`) → `false` para todo rango acotado (edge case "sesiones sin actividad registrada").
3. En otro caso → `now - updatedAt <= durationMs`.

> Una ejecución en curso permanece visible mientras siga generando actividad porque `time.updated` avanza con cada evento (FR-009, US2 esc. 7).

### 4.2 Intersección por grupo (FR-005, FR-010, FR-017, FR-020)

```ts
filterGroups(groups: TSessionGroup[], filters: { directories: string[]; range: TTimeRange; now: number }): TSessionGroup[]
```

1. Si `directories` está vacío → no se filtra por proyecto (todos) (FR-003).
2. Para cada grupo: si `directories` no está vacío y `group.directory` no pertenece a él → se descarta el grupo entero.
3. Para cada item del grupo: se conserva si `isWithinTimeRange(item.session.time.updated, range, now)`.
4. Si el grupo queda sin items → se descarta por completo (FR-017).
5. Se preserva el orden de entrada de grupos e items (FR-020: actividad más reciente primero, tal como lo entrega `useRootSessions`).

### 4.3 URL (FR-013, FR-014, FR-015)

| Operación | Regla |
|-----------|-------|
| `serializeProjects(dirs)` | `dirs.map(encodeURIComponent).join(',')`; `[]` → `undefined` (se borra el parámetro) |
| `parseProjects(raw)` | `undefined`/vacío → `[]`; si no, `split(',')` + `decodeURIComponent` tolerante (try/catch por segmento) + descarte de vacíos |
| `serializeRange(range)` | `range === 'all'` → `undefined` (se borra el parámetro); si no, el propio valor |
| `parseTimeRange(raw)` | valor conocido → ese valor; cualquier otro → `all` |

- La URL es la **única fuente** del estado (R1): no hay estado duplicado en React.
- Limpiar filtros (`clearFilters`) borra ambos parámetros y deja la dirección sin filtros (US3 esc. 4).

---

## 5. Máquina de estados de la vista (FR-019, FR-011)

La página compone estados en este orden; la capa de filtros solo actúa en el último:

```
isError ───────────────► EmptyScreenError
isLoading ─────────────► SessionListSkeleton
items.length === 0 ────► EmptyState "Sin sesiones"        (sin barra de filtros)
datos ─────────────────► Page
                          ├─ SessionFilterBar              (siempre visible, FR-024)
                          └─ isEmptyResult && hasActiveFilters
                               ├─ sí ─► EmptyScreenFilter  (acción: limpiar, FR-011/SC-005)
                               └─ no ─► SessionList        (grupos con conteo, FR-016)
```

| Transición | Condición | Resultado |
|------------|-----------|-----------|
| Filtro → sin resultados | `isEmptyResult && hasActiveFilters` | `EmptyScreenFilter` accionable, barra visible (FR-025) |
| Filtro → con resultados | `!isEmptyResult` | `SessionList` filtrada con conteos |
| Limpiar | `clearFilters` | vuelve a `groups` completos y URL sin filtros (SC-006) |
| Tick en vivo | `now` avanza con `range !== 'all'` | `filteredGroups` se recomputa sin recargar (FR-022) |

---

## 6. Invariantes

1. **Vacío = todos**: un `projects` vacío nunca deja la lista vacía (FR-003, edge case).
2. **Solo proyectos con sesiones**: `options` se deriva del catálogo sin filtrar; no hay opciones vacías (FR-004).
3. **Intersección, no unión**: una sesión visible cumple proyecto **y** rango (FR-010, SC-002).
4. **Grupos vacíos ocultos**: nunca se muestra un encabezado sin sesiones (FR-017).
5. **Orden estable**: el filtrado no reordena; se preserva el orden de `useRootSessions` (FR-020).
6. **Degradación sin error**: URL inválida → defaults, sin estado de error (FR-015).
7. **0 regresiones sin filtros**: sin filtros activos, `filteredGroups` es idéntico a `groups` (SC-004).
