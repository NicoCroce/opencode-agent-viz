# Research — Filtros de proyecto y recencia en el listado de sesiones

**Feature**: `005-session-filters`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100%): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación. Todas se apoyan en código ya existente del dominio `Sessions` y en primitivas ya instaladas; **no se añaden dependencias**.

---

## R1. Dónde vive el estado de los filtros y cómo se refleja en la URL (FR-013, FR-014)

**Decision**: El estado es la **dirección de la página**. Se usa el hook existente `useURLParams` (`src/Application/Hooks/useURLParams.ts`, basado en `useSearchParams` de React Router con `replace: true`) con dos parámetros:

- `projects` — lista de directorios seleccionados, `encodeURIComponent` por elemento y unidos por `,`.
- `range` — uno de `1h | 24h | 7d | 30d | all`.

Un hook `useSessionFilters` (en `Sessions/Hooks`) lee/escribe estos parámetros y devuelve estado + handlers. La lógica de parseo/serialización es pura (`parseProjects`, `serializeProjects`, `parseTimeRange`) y vive en `Sessions/lib/sessionFilters.ts`.

**Rationale**:
- La spec exige que recargar o compartir el enlace reproduzca la misma selección (FR-013/FR-014) y que "limpiar" deje la dirección sin filtros (US3 escenario 4). La URL es la única fuente que cumple ambas cosas sin estado adicional.
- `useURLParams` ya resuelve el ciclo React Router ↔ query string y usa `replace: true` (no ensucia el historial al alternar filtros). Reutilizarlo evita reimplementar el manejo de `URLSearchParams`.
- Los directorios contienen `/`, por lo que se codifican con `encodeURIComponent` antes de unirlos por `,`. Un único parámetro `projects` es compatible con `URLSearchParams.set` (que sobrescribe duplicados); usar parámetros repetidos exigiría `append` y salirse del wrapper existente.

**Alternatives considered**:
- Estado local (`useState`/`useReducer`) + sincronización manual con la URL: descartado; duplica la fuente de verdad y arriesga desincronización.
- `localStorage`/Zustand: descartado explícitamente por la spec ("no se persisten como preferencia del navegador más allá de la URL").
- Parámetros repetidos (`?projects=a&projects=b`): descartado; el wrapper actual usa `set`, no `append`.

---

## R2. Formato y validación de la URL (FR-015, edge cases)

**Decision**: Parseo **tolerante** con funciones puras:

- `parseTimeRange(raw)`: si `raw` es uno de los cinco valores conocidos, se usa; en cualquier otro caso (ausente, `null`, cadena vacía, valor desconocido) → `all` (default). Nunca lanza.
- `parseProjects(raw)`: `undefined`/vacío → `[]` (que significa "todos"); en caso contrario, se decodifica cada segmento con `decodeURIComponent` (con `try/catch` por segmento para no romper ante `%` malformado) y se descartan vacíos.
- La **validez contra el catálogo actual** se resuelve después: `useSessionFilters` intersecta los directorios seleccionados con las opciones realmente presentes (`validSelected = selected ∩ optionDirectories`). Si la intersección queda vacía, se trata como "sin filtro de proyecto" (todos), cumpliendo el edge case "proyecto inexistente se ignora y se muestran los restantes" y FR-003 ("vacío = todos", nunca "ninguno").

**Rationale**: La spec fija que el conjunto de rangos es **cerrado y conocido de antemano** (Assumptions), lo que permite validar la URL sin consultar al servidor. Degradar a los defaults en lugar de mostrar errores es requisito explícito (FR-015 y edge cases "dirección con un rango inválido" y "dirección con un proyecto inexistente"). Mantener el catálogo fuera del parseo puro deja `parseProjects` como una función puramente sintáctica y testeable, y concentra la semántica de "proyecto que ya no existe" en el hook.

**Alternatives considered**:
- Rechazar la URL entera si un valor es inválido: descartado; contradice FR-015 (ignorar y sustituir por el default).
- Validar contra el catálogo dentro del parseo puro: descartado; acoplaría una función pura a datos del render y dificultaría el test.

---

## R3. Modelo del rango temporal y evaluación por última actividad (FR-007..FR-009)

**Decision**: Rangos predefinidos con duración fija en ms, evaluados sobre `session.time.updated`:

| Valor URL | Etiqueta visible | Duración (ms) |
|-----------|------------------|---------------|
| `1h` | Última hora | 3 600 000 |
| `24h` | Últimas 24 horas | 86 400 000 |
| `7d` | Últimos 7 días | 604 800 000 |
| `30d` | Últimos 30 días | 2 592 000 000 |
| `all` | Todo | — (sin corte) |

Función pura `isWithinTimeRange(updatedAt, range, now)`:
- `range === 'all'` → `true` siempre.
- Si `updatedAt` no es un número finito → `false` para cualquier rango acotado (edge case "sesiones sin actividad registrada … fuera de cualquier rango salvo todo").
- En otro caso → `now - updatedAt <= durationMs`.

**Rationale**:
- FR-009 exige evaluar la **última actividad** (no la creación); `SessionInfo.time.updated` es exactamente esa marca y ya se usa en `useRootSessions` para ordenar y en `SessionCard` para el rango de fechas.
- Una ventana rodante (`now - updatedAt <= duration`) hace que una ejecución en curso permanezca visible mientras siga generando actividad, aunque haya empezado antes del rango (FR-009, US2 escenario 7): al actualizarse `time.updated` por SSE, se mantiene dentro.
- La aritmética en ms evita zonas horarias y librerías de fechas (Assumptions: reloj local, sin conversión).

**Alternatives considered**:
- Fechas de calendario (p. ej. "hoy"): descartado; la spec pide ventanas rodantes relativas a la hora actual.
- Evaluar sobre `time.created`: descartado explícitamente por FR-009.
- Librería de fechas (`date-fns`): descartado; aritmética en ms suficiente, sin dependencias nuevas.

---

## R4. Ventana rodante en vivo (FR-022, SC-007)

**Decision**: Un hook `useNow(active: boolean, intervalMs = 1000)` mantiene un `now` en estado que se actualiza con `setInterval` **solo cuando `active` es `true`** (es decir, `range !== 'all'`). Al desmontar o al pasar a "todo", el intervalo se limpia. El resultado filtrado se calcula con `useMemo([groups, validSelected, range, now])`.

**Rationale**:
- SC-007 exige que una sesión que cruza el límite desaparezca **en menos de 5 segundos** sin acción del usuario. Un tick de 1000 ms garantiza el margen con holgura y es trivialmente testeable con temporizadores falsos.
- Con "todo" no hay corte temporal y el paso del tiempo no altera la lista (edge case): desactivar el intervalo evita re-renders inútiles. Esto cumple el Principio VII sin tocar el flujo de eventos.
- El tick **no** dispara red: solo recompone un `useMemo` sobre datos ya en caché. La lista se reconcilia por keys estables (`group.directory`, `session.id`) y la barra es hermana (no re-montada), por lo que se preservan scroll y foco (edge case "ventana en vivo durante la lectura").
- El `now` se inyecta en las funciones puras, de modo que la lógica de rango se testea sin depender del reloj real.

**Alternatives considered**:
- Intervalo de 5 s: descartado; el límite es "menos de 5 segundos", y un intervalo de 5 s podría llegar justo al límite.
- Programar un `setTimeout` a la próxima frontera exacta entre sesiones visibles: más eficiente en teoría, pero más complejo y frágil ante `time.updated` que cambia por SSE; descartado por sobre-ingeniería para el tamaño del listado.
- Reevaluar solo al interactuar: descartado; viola FR-022 (recomposición sin intervención).

---

## R5. Control de proyecto: multiselección accesible (FR-002, FR-004, FR-023, FR-025)

**Decision**: `ProjectFilter` compone `Popover` + `Checkbox` (ambos ya instalados y exportados por `ui/`) dentro de un `Button` disparador:

- Disparador (`Button`, `variant="outline"`): muestra `Todos` cuando no hay selección válida, o `N proyecto(s)` cuando hay marcas; expone el resumen (FR-025).
- Contenido del popover: lista de `TProjectOption` con `Checkbox` por opción; etiqueta principal = `folderName(directory)`, secundaria = ruta completa en monoespaciado truncado (FR-023/SC-008). Contenedor con `max-height` y `overflow-auto` para que "muchos proyectos" no desplace el listado (edge case).
- Cada `Checkbox` con `aria-label` que incluye nombre + ruta, para desambiguar homónimos ante tecnologías de asistencia (FR-021).

**Rationale**:
- FR-002 exige multiselección; el `Select` existente es de selección única, así que no sirve. `Popover` + `Checkbox` es el patrón accesible estándar ya disponible en el repo (Radix gestiona foco, `Escape` y navegación por teclado).
- FR-004 limita las opciones a proyectos con al menos una sesión: las opciones se derivan de los `groups` **sin filtrar** (el catálogo de proyectos observables), por lo que no aparecen proyectos vacíos.
- FR-023/SC-008 piden nombre + ruta: se reutiliza `folderName` (`@app/Application/Helpers`) para la etiqueta principal.
- No se crea una abstracción genérica de multiselect: `ProjectFilter` es el único consumidor y vive en el dominio.

**Alternatives considered**:
- `@radix-ui/react-menubar` con `CheckboxItem`: viable, pero el menubar está pensado para barras de menú; Popover+Checkbox es más directo y ya se usa el patrón de botón en el dominio.
- Chips/toggles inline (un botón por proyecto): descartado; con muchas carpetas satura la barra y empuja el listado (edge case "muchos proyectos").
- `Select` múltiple: descartado; el componente del repo es single-select.

---

## R6. Control temporal: reutilizar el `Select` existente (FR-006, FR-007)

**Decision**: `TimeRangeFilter` reutiliza el `Select` de `@app/Application/Components` con las cinco opciones de la tabla de R3. El valor activo se refleja en el control y en el resumen de la barra.

**Rationale**: El conjunto de rangos es cerrado y predefinido (FR-007), exactamente el caso de uso del `Select` actual (Radix, accesible, `aria-*` gestionados). Reutilizarlo mantiene consistencia visual y evita un control nuevo.

**Alternatives considered**:
- `ToggleGroup` (instalado) tipo segmentos: viable, pero con cinco etiquetas largas ("Últimas 24 horas", …) satura en móvil; el `Select` colapsa bien.
- Botones sueltos: descartado; sin semántica de selección única.

---

## R7. Composición de la barra y del estado vacío (FR-011, FR-024, FR-025, SC-005, SC-006)

**Decision**: `SessionFilterBar` es una fila (`Container row`, `justify="between"`) siempre visible entre el título y el listado (FR-024). Contiene `ProjectFilter`, `TimeRangeFilter`, y —solo mientras hay filtros activos— un resumen textual (`N proyectos · <etiqueta de rango>`) y una acción **"Limpiar filtros"** (`Button variant="link"`) siempre a la vista (FR-025, SC-006).

Cuando la intersección no deja ninguna sesión y **sí hay filtros activos**, la página renderiza `EmptyScreenFilter` (existente) con `onClick = clearFilters`, en lugar de `EmptyState` (FR-011/SC-005). La barra permanece visible para poder limpiar.

**Rationale**: `EmptyScreenFilter` ya existe con el texto "No se encontraron coincidencias" y una acción de "Actualizar filtros"; reutilizarlo garantiza un estado distinto del "Sin sesiones" de arranque (FR-011, SC-005). Mantener la barra visible junto al vacío permite recuperar el listado en 1 interacción (SC-006).

**Alternatives considered**:
- Ocultar la barra cuando no hay resultados: descartado; dejaría al usuario sin acción visible (FR-025).
- Un estado vacío nuevo específico: descartado; `EmptyScreenFilter` ya cubre el caso y evita duplicar UI.

---

## R8. Ocultación de grupos vacíos y conteo por grupo (FR-016, FR-017)

**Decision**: El filtrado se aplica **por grupo**: se recorre cada `TSessionGroup`, se filtran sus `items` por proyecto + rango y, si el grupo queda sin items, se **descarta por completo** (incluido su encabezado). `SessionList` renderiza, en el encabezado de cada grupo visible, el número de sesiones mostradas (FR-016).

**Rationale**: FR-017 exige que un grupo sin sesiones que cumplan los filtros se oculte entero, y FR-016 que el encabezado indique cuántas muestra. Como el filtrado ya devuelve grupos recortados, el conteo es `group.items.length` y no requiere cálculo extra. El orden dentro de cada grupo no se altera (FR-020): `useRootSessions` ya ordena por `time.updated` descendente y el filtro preserva el orden de entrada.

**Alternatives considered**:
- Mostrar grupos vacíos con "0 sesiones": descartado por FR-017.
- Reordenar por actividad tras filtrar: descartado; FR-020 mantiene el orden actual.

---

## R9. Estado de pantalla y alcance (FR-018, FR-019, edge cases)

**Decision**: `SessionListPage` conserva el orden actual de estados y añade la capa de filtros solo en el caso "datos":

1. `isError` → `EmptyScreenError`.
2. `isLoading` → `SessionListSkeleton`.
3. `items.length === 0` → `EmptyState` "Sin sesiones" **sin** barra de filtros (edge case "sin sesiones en absoluto").
4. datos → `Page` con `SessionFilterBar` + (`filteredGroups` vacío **y** filtros activos → `EmptyScreenFilter`; si no, `SessionList`).

Los filtros se aplican **solo** en esta página; `SessionList` se sigue usando sin filtros en cualquier otro punto (FR-018) porque el filtrado ocurre en la página/hook, no dentro del componente de lista. Si los filtros están activos mientras cargan los datos, el `useMemo` se recalcula en cuanto llegan (edge case "cambio de filtro mientras cargan los datos").

**Rationale**: Cumple FR-019 y mantiene 0 regresiones con filtros desactivados (SC-004): sin filtros, `filteredGroups` es idéntico a `groups`. El edge case "sesión abierta que sale del rango" queda fuera de esta página (la navegación al detalle ya se inició), como aclara la spec.

**Alternatives considered**:
- Filtrar dentro de `SessionList`: descartado; acoplaría la lista al estado de la página y rompería FR-018.
- Mostrar la barra también en el estado "sin sesiones": descartado por el edge case explícito.

---

## R10. Sin cambios de datos, SDK, hooks base ni eventos (Assumptions, Principios I/III/VII)

**Decision**: No se tocan `Sessions.service.ts`, `Session.entity.ts`, `queryKeys.ts`, `useRootSessions.ts`, el reducer de eventos ni `Infrastructure`. No se añaden endpoints, queries ni invalidaciones. La feature **deriva** de los `groups` ya existentes.

**Rationale**: La spec acota la feature a "visibilidad y estado de vista" (Key Entities, Assumptions). Mantener el origen de datos intacto protege los Principios I, III y VII y minimiza el riesgo de regresión. `useRootSessions` ya entrega `groups` con `directory` e `items` (con `session.time.updated`), todo lo que los filtros necesitan.

**Alternatives considered**:
- Precomputar opciones/filtros en `useRootSessions`: descartado; mezclaría responsabilidades de datos con estado de vista y dificultaría testear el hook de datos existente.
- Añadir un parámetro de filtro al endpoint `/session`: descartado; el filtrado es de presentación y el server no ofrece esos filtros.

---

## Resumen de decisiones

| # | Decisión | FR/SC |
|---|----------|-------|
| R1 | URL (search params) como única fuente de estado, vía `useURLParams` | FR-013, FR-014 |
| R2 | Parseo tolerante con degradación a defaults | FR-015 |
| R3 | Rangos en ms sobre `time.updated`, ventana rodante | FR-007..FR-009 |
| R4 | `useNow(active)` con tick de 1 s, desactivado en "todo" | FR-022, SC-007 |
| R5 | `ProjectFilter` = Popover + Checkbox, opciones con nombre + ruta | FR-002, FR-004, FR-023, FR-025 |
| R6 | `TimeRangeFilter` reutiliza el `Select` existente | FR-006, FR-007 |
| R7 | Barra siempre visible + `EmptyScreenFilter` accionable | FR-011, FR-024, FR-025, SC-005, SC-006 |
| R8 | Ocultar grupos vacíos + conteo por encabezado | FR-016, FR-017 |
| R9 | Orden de estados preservado; filtros solo en la página | FR-018, FR-019 |
| R10 | Sin cambios de datos/SDK/SSE | Principios I/III/VII |
