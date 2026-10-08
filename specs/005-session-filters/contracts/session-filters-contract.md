# Contract — Session filters (barra, controles y URL)

**Feature**: `005-session-filters`
**Página orquestadora**: `src/Domains/Sessions/Pages/SessionList.page.tsx`
**Hook de estado**: `src/Domains/Sessions/Hooks/useSessionFilters.ts`
**Lógica pura**: `src/Domains/Sessions/lib/sessionFilters.ts`

Este contrato fija el comportamiento observable de la barra de filtros, de los controles y del
formato de la dirección de la página. Es verificable con tests de Testing Library (roles, texto,
`aria-*`, orden del DOM) y con tests puros de `sessionFilters.ts`.

---

## 1. Composición de la página (FR-018, FR-019, FR-024)

`SessionListPage` conserva el orden de estados actual y añade la barra **solo** en el caso "datos":

```
1. isError ───────────► EmptyScreenError
2. isLoading ─────────► SessionListSkeleton
3. items.length === 0 ► EmptyState "Sin sesiones"        (SIN barra de filtros)
4. datos ─────────────► Page title="Sesiones de OpenCode"
                          ├─ SessionFilterBar            [FR-024: entre título y listado]
                          └─ isEmptyResult && hasActiveFilters
                               ├─ sí ─► EmptyScreenFilter  [FR-011]
                               └─ no ─► SessionList        [FR-016: conteo por grupo]
```

**Invariantes**:
- La barra está **entre el título de la página y el listado** y es **siempre visible** en el estado de datos; no requiere expandir nada (FR-024).
- El estado "sin sesiones en absoluto" **no** muestra controles de filtro (edge case).
- Los filtros se aplican **solo** en esta página; `SessionList` no conoce el estado de filtros y se sigue usando sin cambios en otros puntos (FR-018).
- Sin filtros activos, el listado es idéntico al actual (mismo contenido y orden; 0 regresiones) (SC-004, FR-020).

---

## 2. Barra de filtros (`SessionFilterBar`) (FR-024, FR-025, SC-006)

```ts
interface SessionFilterBarProps {
  options: TProjectOption[];            // catálogo de proyectos con sesiones (FR-004)
  selectedProjects: string[];           // directorios marcados; [] = todos
  range: TTimeRange;                    // rango activo
  onToggleProject: (directory: string) => void;
  onRangeChange: (range: TTimeRange) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}
```

| Aspecto | Contrato |
|---------|----------|
| Ubicación | Fila siempre visible sobre el listado, dentro del `Page` (FR-024). |
| Contenido fijo | Control de proyecto + control de rango temporal (FR-001, FR-006). |
| Resumen | Con filtros activos, muestra `N proyectos` (o `Todos`) y la etiqueta del rango; visible sin expandir nada (FR-025). |
| Limpiar | Con filtros activos, muestra una acción **"Limpiar filtros"** siempre visible; al pulsarla, el listado vuelve a mostrar todas las sesiones y la URL queda sin filtros (FR-012, SC-006, US3 esc. 4). |
| Sin filtros | El resumen y la acción de limpiar pueden omitirse; los controles permanecen visibles en su estado por defecto. |

---

## 3. Filtro de proyecto (`ProjectFilter`) (FR-001..FR-005, FR-023, SC-008)

```ts
interface ProjectFilterProps {
  options: TProjectOption[];
  selected: string[];                   // directorios marcados; [] = todos
  onToggle: (directory: string) => void;
}
```

| Aspecto | Contrato |
|---------|----------|
| Tipo | Multiselección (FR-002). Cada opción es un `Checkbox`. |
| Estado vacío | Sin marcas = **todos** los proyectos, nunca "ninguno" (FR-003, edge case). |
| Opciones | Solo proyectos con al menos una sesión en el listado, sin opciones vacías (FR-004). |
| Etiqueta principal | `folderName(directory)` (FR-023). |
| Texto secundario | Ruta completa, truncada, en monoespaciado (FR-023). |
| Homónimos | Dos proyectos con la misma carpeta se distinguen por la ruta completa (SC-008, US1 esc. 6). |
| Disparador | Muestra `Todos` o `N proyecto(s)`; es un `Button` con nombre accesible. |
| Muchos proyectos | La lista de opciones tiene altura máxima y scroll propio; no desplaza el listado (edge case "muchos proyectos"). |
| Teclado/a11y | Operable con teclado; cada opción anuncia su estado marcado/no marcado (FR-021). |

**Efecto**: con proyectos marcados, solo se muestran las sesiones de esos proyectos y desaparecen los grupos de los demás (FR-005, US1 esc. 2/3/4).

---

## 4. Filtro temporal (`TimeRangeFilter`) (FR-006..FR-009, FR-022, SC-007)

```ts
interface TimeRangeFilterProps {
  value: TTimeRange;
  onChange: (range: TTimeRange) => void;
}
```

| Aspecto | Contrato |
|---------|----------|
| Opciones | `Última hora` (`1h`), `Últimas 24 horas` (`24h`), `Últimos 7 días` (`7d`), `Últimos 30 días` (`30d`), `Todo` (`all`) (FR-007). |
| Default | `all` (FR-008). |
| Evaluación | Sobre `session.time.updated` (última actividad), no `time.created` (FR-009). |
| En curso | Una sesión con actividad reciente permanece dentro del rango aunque haya empezado antes (FR-009, US2 esc. 7). |
| Ventana en vivo | Con un rango acotado, la lista se recompone por el paso del tiempo sin recargar; una sesión que cruza el límite desaparece en **< 5 s** (FR-022, SC-007). |
| "Todo" | Sin corte temporal; el paso del tiempo no altera la lista (edge case). |
| Control | Reutiliza el `Select` existente; anuncia el rango activo (FR-021). |

---

## 5. Contrato de la URL (FR-013, FR-014, FR-015)

La dirección de la página es la **única fuente de estado**. Formato:

```
/sessions?projects=<dir1>,<dir2>&range=<1h|24h|7d|30d|all>
```

| Parámetro | Serialización | Parseo | Default / inválido |
|-----------|---------------|--------|--------------------|
| `projects` | Cada directorio con `encodeURIComponent`, unidos por `,`. Vacío → parámetro ausente. | `split(',')` + `decodeURIComponent` tolerante (try/catch por segmento), descartando vacíos. | Ausente/vacío → `[]` = todos. |
| `range` | Valor literal; `all` → parámetro ausente. | Se compara contra el conjunto cerrado. | Ausente/desconocido → `all`. |

**Reglas**:
- Al aplicar un filtro, la URL se actualiza con `replace: true` (sin ensuciar el historial) (FR-013).
- Al abrir una URL con filtros, estos se restauran y aplican (FR-014).
- Un proyecto que ya no existe se **ignora**: `validSelected = selectedProjects ∩ optionDirectories`; si la intersección queda vacía, se muestran todos (edge case, FR-015).
- Un rango inválido o desconocido cae a `all` sin error visible (edge case, FR-015).
- Limpiar filtros elimina ambos parámetros de la dirección (US3 esc. 4).
- Recargar la página reproduce la misma selección (US3 esc. 2); compartir el enlace reproduce la misma vista para otra persona (US3 esc. 3).

---

## 6. Reglas de filtrado (contrato puro)

### 6.1 Rango

```ts
isWithinTimeRange(updatedAt, range, now): boolean
```
- `all` → `true`.
- `updatedAt` no finito → `false` para rangos acotados.
- Si no → `now - updatedAt <= durationMs(range)`.

### 6.2 Intersección y grupos

```ts
filterGroups(groups, { directories, range, now }): TSessionGroup[]
```
- `directories` vacío → sin filtro de proyecto (todos).
- Grupo cuyo `directory` no está en `directories` → descartado entero.
- Items fuera del rango → descartados.
- Grupo sin items → descartado entero, incluido su encabezado (FR-017).
- El orden de grupos e items se preserva (FR-020).

### 6.3 Opciones y conteo

```ts
buildProjectOptions(groups): TProjectOption[]   // catálogo sin filtrar, sin vacíos (FR-004)
```
- `SessionList` muestra el conteo `group.items.length` en el encabezado de cada grupo visible (FR-016).

---

## 7. Estados y accesibilidad (FR-011, FR-019, FR-021, SC-005)

| Estado | Contrato |
|--------|----------|
| Error de carga | `EmptyScreenError` (sin barra). |
| Carga | `SessionListSkeleton` (sin barra). |
| Sin sesiones | `EmptyState` "Sin sesiones" (sin barra). |
| Datos sin resultados de filtro | `EmptyScreenFilter` ("No se encontraron coincidencias") con acción de limpiar; **nunca** el estado "Sin sesiones" (FR-011, SC-005). |
| Datos con resultados | `SessionList` filtrada con conteos. |

**Accesibilidad (FR-021)**:
- Los controles son operables con teclado (Radix gestiona foco y `Escape`).
- Los `Checkbox` exponen `aria-checked` (marcado/no marcado) y un nombre accesible con nombre de carpeta + ruta.
- El `Select` de rango anuncia el rango activo.
- El disparador del filtro de proyecto expone un nombre accesible con el resumen (`Todos` / `N proyectos`).

---

## 8. Fuera de contrato (no cambia)

- Obtención de datos: `useRootSessions`, `Sessions.service.ts`, SDK, eventos SSE, `queryKeys.ts`.
- Tipos de dominio: `Session.entity.ts` no gana ni cambia tipos.
- `SessionCard` (contenido de cada sesión) y el estado de conexión.
- El listado lateral del espacio de trabajo: **sin cambios** (FR-018).
- No hay búsqueda por texto ni rango de fechas personalizado (Assumptions).
