# Área 05 — Sessions / Projects

> Análisis **de solo lectura**. No se modifica código de producto. Umbral de archivo
> GORDO: **≥ 150 líneas** (según `docs/internal/proposals/inventario-gordos.md`, contando solo
> `.ts`/`.tsx` bajo `src/Domains/Sessions/**` y `src/Domains/Projects/**`, excluyendo
> `*/specs/*`, `*.spec.ts(x)`).

## Resumen del área

- **Un único archivo GORDO** en toda el área: `src/Domains/Sessions/lib/sessionFilters.ts`
  (**221 líneas**, motivo **(e) OTRO** — lib pura que acumula tipos de vista, constantes,
  parseo/serialización de URL, evaluación de rango, intersección y construcción de
  opciones de proyecto).
- **No hay componentes gordos.** El resto de componentes/páginas está por debajo del
  umbral y ya son, en general, presentación pura:
  `SessionFilterBar` (118), `SessionList` (69), `SessionCard` (66), `TimeRangeFilter` (53),
  `ProjectFilter` (99), `SessionListSkeleton` (9), `SessionList.page` (70).
- **Hooks pequeños y bien separados** (`useRootSessions` 87, `useSessionFilters` 138,
  `useNow` 48, `useSelectSession` 22). La única deuda son **dos duplicaciones
  transversales concretas**:
  1. **`useNow` duplicado literal** entre `Sessions/Hooks/useNow.ts` (48 líneas) y
     `Graph/Hooks/useNow.ts` (49 líneas): misma implementación, **distinta firma y
     distinto orden de argumentos** (`(active, intervalMs=1000)` vs `(intervalMs=1000, enabled=true)`).
     Lo consumen `useSessionFilters`, `useGraphModel` y `WorkspacePage`.
  2. **`projectsSummary` + `ALL_PROJECTS_LABEL` duplicados literalmente** en
     `ProjectFilter.tsx` (líneas 23-29) y `SessionFilterBar.tsx` (líneas 12, 25-29).
- **Projects** es un dominio mínimo y correcto (entity 23 / service 15 / hook 13);
  no requiere descomposición, pero `projectDirectories` se reutiliza desde Sessions
  (bien: cross-domain vía import, no vía componente).

**Conclusión:** el área no necesita una descomposición masiva; necesita **atomizar la lib
de filtros** y **consolidar dos duplicaciones transversales** (`useNow` y el resumen de
proyectos) en piezas reutilizables.

---

## Propuestas por archivo

### `src/Domains/Sessions/lib/sessionFilters.ts` — 221 líneas (motivo: (e) OTRO)

Concentra cinco responsabilidades independientes en un solo módulo: vocabulario del rango
temporal, transporte URL, evaluación de ventana, intersección de grupos y catálogo de
proyectos. Cada una es testeable por separado y `now` ya se inyecta (diseño puro correcto).
Se propone partirla en 4 libs atómicas y dejar el archivo como barrel de compatibilidad.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `timeRange` | lib pura | `src/Domains/Sessions/lib/timeRange.ts` | `TTimeRange`, `TTimeRangeOption`, `DEFAULT_TIME_RANGE`, `TIME_RANGES`, `durationFor(range)`, `isWithinTimeRange(updatedAt, range, now)`, `timeRangeLabel(range) → string` | `TimeRangeFilter`, `SessionFilterBar`, `useSessionFilters`; futuros filtros de recencia (p. ej. Graph/History) | ~55 |
| `filterUrl` | lib pura | `src/Domains/Sessions/lib/filterUrl.ts` | `FILTER_PARAM_KEYS`, `parseProjects(raw)`, `serializeProjects(dirs)`, `parseTimeRange(raw)`, `serializeRange(range)` (usa `timeRange`; `PROJECT_SEPARATOR`/`decodeProject` privados) | `useSessionFilters`, `SessionList.page`; cualquier filtro respaldado por URL | ~50 |
| `projectOptions` | lib pura | `src/Domains/Sessions/lib/projectOptions.ts` | `TProjectOption`, `buildProjectOptions(groups)`, `ALL_PROJECTS_LABEL`, `summarizeProjects(count) → string` | `ProjectFilter`, `SessionFilterBar`, `useSessionFilters`; futuros filtros por directorio | ~35 |
| `groupFilter` | lib pura | `src/Domains/Sessions/lib/groupFilter.ts` | `TSessionFilters`, `TFilterGroupsOptions`, `filterGroups(groups, { directories, range, now })` (usa `isWithinTimeRange`) | `useSessionFilters`; cualquier vista que combine filtro de directorio × ventana temporal | ~42 |
| `sessionFilters` (barrel) | barrel de compatibilidad | `src/Domains/Sessions/lib/sessionFilters.ts` | `export *` de las 4 libs anteriores (mantiene rutas de import existentes) | — | ~6 |

**Resultado estimado:** 221 líneas → 4 libs de 35–55 líneas + barrel de ~6. Ningún archivo
vuelve a cruzar el umbral. La lógica pura se mantiene 100 % testeable y aislada (Principio V).
El contrato de `specs/005-session-filters/contracts/session-filters-contract.md` §5–§6 se
preserva firmando cada función igual que hoy (mismos nombres y firmas).

**Riesgos/specs afectados:**
- `src/Domains/Sessions/lib/specs/sessionFilters.spec.ts` importa todo desde `../sessionFilters`;
  con el barrel **no se rompe**, pero conviene repartir el spec por lib (4 specs) para que
  cada uno testee su unidad.
- Re-imports de tipos/constantes desde `'../lib/sessionFilters'`: `ProjectFilter.tsx`,
  `SessionFilterBar.tsx`, `TimeRangeFilter.tsx`, `useSessionFilters.ts` y los specs
  `ProjectFilter.spec.tsx`, `TimeRangeFilter.spec.tsx`, `SessionFilterBar.spec.tsx`,
  `useSessionFilters.spec.tsx`, `SessionList.page.spec.tsx`. El barrel los mantiene verdes;
  se pueden reapuntar progresivamente a las rutas atómicas.
- No toca contrato observable (roles/`aria-*`/textos) ni la URL; riesgo de regresión bajo.

---

## Piezas atómicas listas para compartir

### 1. `useNow` — reloj en vivo unificado (duplicación literal confirmada)

| Campo | Detalle |
|---|---|
| Tipo | Hook compartido |
| Ruta destino | `src/Application/Hooks/useNow.ts` |
| Contrato | `export const DEFAULT_NOW_INTERVAL_MS = 1000;` · `interface TUseNowOptions { enabled?: boolean; intervalMs?: number }` · `useNow(options?: TUseNowOptions): number` |
| Consumidores previstos | `Sessions/Hooks/useSessionFilters` → `useNow({ enabled: range !== DEFAULT_TIME_RANGE })`; `Graph/Hooks/useGraphModel` → `useNow({ enabled: hasActiveNode })`; `Infrastructure/WorkspacePage` → `useNow({ enabled: Boolean(id) && hasActiveNode })` |
| Reutilizable por | Sessions, Graph, Workspace; cualquier ventana rodante/duration en vivo |
| Líneas | ~40 (consolida 48 + 49 = 97 → 40; elimina 2 archivos) |

**Contrato a unificar (objeto de opciones, no argumentos posicionales):** evita el bug latente
de orden invertido (`active` vs `intervalMs`). El comportamiento ya es idéntico
(refresco al activarse, tick solo si `enabled`, limpieza al desmontar).

**Riesgos/specs afectados:** `Sessions/Hooks/specs/useNow.spec.tsx` y
`Graph/Hooks/specs/useNow.spec.tsx` (reapuntar el `renderHook` al nuevo contrato);
`Graph/index.ts` re-exporta `./Hooks/useNow` (línea 13) y `Graph/Hooks/index.ts` (línea 8)
deben reapuntar al hook compartido. Se pueden borrar `Sessions/Hooks/useNow.ts` y
`Graph/Hooks/useNow.ts`.

### 2. `summarizeProjects` — etiqueta de multiselección de proyectos (duplicación literal)

| Campo | Detalle |
|---|---|
| Tipo | Constante + función pura |
| Ruta destino | `src/Domains/Sessions/lib/projectOptions.ts` |
| Contrato | `export const ALL_PROJECTS_LABEL = 'Todos';` · `summarizeProjects(count: number): string` → `'Todos'` / `'1 proyecto'` / `'N proyectos'` |
| Consumidores previstos | `ProjectFilter` (disparador) y `SessionFilterBar` (resumen) — hoy **duplicada literalmente** en ambos |
| Reutilizable por | Cualquier filtro multiselección del área |
| Líneas | ~10 |

### 3. `timeRangeLabel` — etiqueta visible del rango (duplicación parcial)

| Campo | Detalle |
|---|---|
| Tipo | Función pura |
| Ruta destino | `src/Domains/Sessions/lib/timeRange.ts` |
| Contrato | `timeRangeLabel(range: TTimeRange): string` (busca en `TIME_RANGES`, degrada a `'Todo'`) |
| Consumidores previstos | `SessionFilterBar` (hoy inline en `rangeSummary`, líneas 32-33) y `TimeRangeFilter` (deriva etiquetas) |
| Reutilizable por | Cualquier UI que muestre el rango activo |
| Líneas | ~3 |

### 4. `LabeledSelect` — `Select` con nombre accesible (patrón de filtro)

| Campo | Detalle |
|---|---|
| Tipo | Molécula de presentación |
| Ruta destino | `src/Application/Components/Molecules/LabeledSelect.tsx` |
| Contrato | `interface LabeledSelectProps { label: string; value: string; onChange: (value: string) => void; options: TOptions[]; placeholder: string }` — envuelve el `Select` compartido en `<label>` con texto `sr-only` |
| Consumidores previstos | `TimeRangeFilter` (hoy hace este wrapping a mano) |
| Reutilizable por | Cualquier filtro de selección única futuro (agente, estado) |
| Líneas | ~20 |

### 5. `MultiSelectFilterPopover` — multiselección con checkbox (patrón de filtro)

| Campo | Detalle |
|---|---|
| Tipo | Molécula de presentación |
| Ruta destino | `src/Application/Components/Molecules/MultiSelectFilterPopover.tsx` |
| Contrato | `interface TMultiSelectOption { value: string; label: string; secondary?: string }` · `interface MultiSelectFilterPopoverProps { ariaLabel: string; summary: string; groupLabel: string; options: TMultiSelectOption[]; selected: readonly string[]; onToggle: (value: string) => void; maxHeightClass?: string }` |
| Consumidores previstos | `ProjectFilter` (hoy implementa trigger + `Popover` + `Checkbox` + scroll + homónimos) |
| Reutilizable por | Futuros filtros multiselección (agentes, estados). Hoy tiene un solo consumidor, por lo que es opcional: la duplicación real (pieza 2) se resuelve sin esperar a esta molécula |
| Líneas | ~55 |

**Nota de alcance:** las piezas 4 y 5 son *específicas del patrón de filtro*, no genéricos
abstractos. Conservan el contrato de a11y de `specs/005-session-filters/contracts/...` §7
(disparador con `aria-expanded` y nombre accesible; cada `Checkbox` con `aria-checked` y
nombre = etiqueta + texto secundario) y la lista con scroll propio.

---

## Notas / discrepancias con convenciones

1. **`SessionCard` importa otro dominio desde un componente** (viola AGENTS §8.3):
   `src/Domains/Sessions/Components/SessionCard.tsx:4` importa
   `toNodeStatus` de `@app/Domains/Graph/lib/nodeStatus`. Es un componente importando la lib
   de otro dominio. La convención exige que el cross-domain ocurra en un **hook**. Propuesta
   concreta: mover la derivación `toNodeStatus(...)` a un hook del dominio Sessions
   (p. ej. `Sessions/Hooks/useSessionNodeStatus.ts`, contrato
   `useSessionNodeStatus(status?: TSessionStatus) → TNodeStatus`) y que `SessionCard` reciba
   `nodeStatus: TNodeStatus` por props (presentación pura). **No** se propone como pieza
   compartida, sino como corrección de encapsulamiento.

2. **Validación con Zod ausente en filtros** (AGENTS §10 pide Zod para parámetros/filtros):
   `parseProjects`/`parseTimeRange` hacen parseo tolerante propio, no Zod. Es una decisión
   deliberada del contrato (§5: degradar sin error). Se documenta como **discrepancia
   consciente**; si se adopta Zod para `TTimeRange`, debería seguir degradando a `all` sin
   lanzar, y mantenerse el parseo tolerante de `projects`.

3. **`flex` en elementos no-`div`:** `SessionList.tsx:37` (un `<span className="flex ...">`),
   `SessionCard.tsx:46,52` (un `<button>` con flex) y `ProjectFilter.tsx:74` (un `<label>`).
   No son `div`, por lo que no violan la prohibición literal ("NO divs con flex"), y usar
   `<Container>` (un `div`) dentro de un `span`/`label` sería HTML inválido. Se consideran
   **aceptables**; no se propone refactor.

4. **`useSelectSession` y `useURLParams`:** correctos y pequeños. `useSelectSession` no se usa
   en `SessionList.page` (la página navega con `navigate(sessionDetailPath(id))`), pero es un
   hook válido del dominio; no requiere cambios.

5. **Projects:** sin hallazgos. `projectDirectories` (entity pura) se importa desde
   `Sessions/Hooks/useRootSessions` — cross-domain correcto (hook, no componente). No cumple
   el umbral en ningún archivo.

6. **Sin archivos ≥150 restantes:** tras atomizar `sessionFilters.ts` y consolidar `useNow`,
   ninguna pieza del área se acercará al umbral (la mayor, `useSessionFilters` con 138
   líneas, seguiría delegando en las libs puras).
