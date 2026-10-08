---

description: "Task list for feature implementation"
---

# Tasks: Filtros de proyecto y recencia en el listado de sesiones

**Input**: Design documents from `/specs/005-session-filters/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: **Sí, requeridos.** El plan (`Technical Context` → Testing) y la Constitución (Principio VIII) exigen specs junto al código. Cada tarea de test se escribe primero contra el contrato congelado (`contracts/session-filters-contract.md`) y debe fallar antes de la implementación.

**Organization**: Tareas agrupadas por historia de usuario para permitir implementación y prueba independientes. El trabajo compartido (módulo puro + hook de estado) vive en la fase fundacional porque las tres historias lo consumen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (ficheros distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia a la que pertenece la tarea (`[US1]`, `[US2]`, `[US3]`)
- Cada tarea incluye la ruta exacta del fichero

## Path Conventions

- Proyecto único (SPA frontend): `src/`, specs junto al código en carpetas `specs/` (Constitución VIII).
- Dominio afectado: `src/Domains/Sessions/`.
- Primitivas compartidas: `src/Application/Components/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar primitivas e infraestructura de test ya existentes antes de escribir código nuevo. **No se añaden dependencias** (plan.md, research.md).

- [X] T001 [P] Verificar que las primitivas que consume la feature están exportadas desde `@app/Application/Components` (`Popover`/`PopoverTrigger`/`PopoverContent`, `Checkbox`, `Select`, `Button`, `Container`, `EmptyScreenFilter`) y añadir el re-export que falte en `src/Application/Components/index.ts` o `src/Application/Components/ui/index.ts`
- [X] T002 [P] Crear builders reutilizables de fixtures de sesión y grupo (con `time.updated` y `location.directory` controlables) para los specs nuevos en `src/Domains/Sessions/specs/fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lógica pura de filtrado y estado de vista compartido por las tres historias. **⚠️ CRÍTICO**: ninguna historia puede empezar hasta completar esta fase.

- [X] T003 Crear el módulo puro `src/Domains/Sessions/lib/sessionFilters.ts` con los view-models (`TTimeRange`, `TProjectOption`, `TSessionFilters`), las constantes `TIME_RANGES` y `FILTER_PARAM_KEYS` (sin magic strings), y las funciones puras `parseProjects`, `serializeProjects`, `parseTimeRange`, `serializeRange`, `isWithinTimeRange`, `filterGroups` y `buildProjectOptions` (FR-003, FR-005, FR-007–FR-010, FR-015, FR-017, FR-020, FR-023)
- [X] T004 [P] Escribir los specs puros `src/Domains/Sessions/lib/specs/sessionFilters.spec.ts`: round-trip y degradación tolerante de URL, `isWithinTimeRange` (`all` / no finito / frontera), `filterGroups` (intersección, grupos vacíos descartados, orden preservado) y `buildProjectOptions` (sin opciones vacías, nombre + ruta)
- [X] T005 Crear el reloj en vivo `src/Domains/Sessions/Hooks/useNow.ts` (activable, intervalo inyectable con default 1000 ms, limpia el `setInterval` al desactivarse o desmontar) (FR-022, SC-007)
- [X] T006 [P] Escribir los specs `src/Domains/Sessions/Hooks/specs/useNow.spec.tsx` con temporizadores falsos: tick cuando `active`, sin tick cuando inactivo, limpieza al desmontar
- [X] T007 Crear el hook de estado `src/Domains/Sessions/Hooks/useSessionFilters.ts` con la firma `useSessionFilters(groups: TSessionGroup[])` — recibe los grupos ya calculados, **no** llama a `useRootSessions` (la página es la única que se suscribe, para evitar doble fetch): lee/escribe `projects` y `range` vía `useURLParams` (única fuente de estado), deriva `options`, `validSelected`, `hasActiveFilters`, `filteredGroups` e `isEmptyResult`, y expone `toggleProject`, `setRange` y `clearFilters`. `clearFilters` MUST usar `updateParams({ projects: undefined, range: undefined })` y **nunca** `clearParams`, para no borrar otros parámetros de la dirección (FR-003, FR-010, FR-013–FR-015, FR-022, FR-026)
- [X] T008 [P] Escribir los specs `src/Domains/Sessions/Hooks/specs/useSessionFilters.spec.tsx`: restauración desde URL, degradación de valores inválidos, "vacío = todos", `clearFilters` y recomposición en vivo del resultado con temporizadores falsos
- [X] T009 Actualizar el barrel `src/Domains/Sessions/Hooks/index.ts` para exportar `useSessionFilters` y `useNow`

**Checkpoint**: Lógica pura y estado de filtros listos y probados; las historias de UI pueden empezar.

---

## Phase 3: User Story 1 - Ver solo las sesiones de los proyectos que me interesan (Priority: P1) 🎯 MVP

**Goal**: Barra de filtros siempre visible entre el título y el listado, con multiselección de proyectos (nombre de carpeta + ruta completa); "vacío = todos"; los grupos del resto desaparecen.

**Independent Test**: Abrir el listado con sesiones en varios proyectos, seleccionar un único proyecto y comprobar que solo permanecen sus sesiones y que los grupos del resto desaparecen; al desmarcar todo, vuelven todos los proyectos.

### Tests for User Story 1 ⚠️

> **NOTA: escribir estos tests primero y comprobar que fallan antes de implementar.**

- [X] T010 [P] [US1] Escribir `src/Domains/Sessions/Components/specs/ProjectFilter.spec.tsx`: un `Checkbox` por opción, etiqueta con nombre de carpeta + ruta completa, `onToggle(directory)`, `aria-checked` y disparador que muestra `Todos` / `N proyecto(s)`
- [X] T011 [P] [US1] Escribir `src/Domains/Sessions/Components/specs/SessionFilterBar.spec.tsx`: la barra renderiza el control de proyecto y permanece siempre visible en el estado de datos
- [X] T012 [P] [US1] Actualizar `src/Domains/Sessions/Components/specs/SessionList.spec.tsx` para asertar el conteo de sesiones por encabezado de grupo (FR-016)
- [X] T013 [P] [US1] Escribir el spec de integración de página `src/Domains/Sessions/Pages/specs/SessionList.page.spec.tsx`: orden de estados error→carga→vacío→datos, barra visible en "datos", filtrado por proyecto acota la lista y `EmptyScreenFilter` con acción de limpiar ante intersección sin resultados (FR-011, FR-018, FR-019, FR-024)

### Implementation for User Story 1

- [X] T014 [P] [US1] Crear `src/Domains/Sessions/Components/ProjectFilter.tsx` (Popover + Checkbox; disparador `Button` con resumen; opciones con `folderName` + ruta en monoespaciado truncado; lista con altura máxima y scroll propio; `aria-label` con nombre + ruta) (FR-001–FR-005, FR-021, FR-023, SC-008)
- [X] T015 [US1] Modificar `src/Domains/Sessions/Components/SessionList.tsx` para mostrar `group.items.length` en el encabezado de cada grupo visible (FR-016)
- [X] T016 [US1] Crear `src/Domains/Sessions/Components/SessionFilterBar.tsx` como fila siempre visible (`Container row`, `justify="between"`) que aloja el control de proyecto (FR-024)
- [X] T017 [US1] Actualizar `src/Domains/Sessions/Components/index.ts` para exportar `ProjectFilter` y `SessionFilterBar`
- [X] T018 [US1] Actualizar `src/Domains/Sessions/Pages/SessionList.page.tsx` para consumir `useSessionFilters`, renderizar `SessionFilterBar` entre el título y el listado, y elegir entre `EmptyScreenFilter` (cuando `isEmptyResult && hasActiveFilters`) y `SessionList` con `filteredGroups` (FR-011, FR-018, FR-019, FR-024)
- [X] T032 [US1] Extender `src/Application/Components/Molecules/EmptyScreenFilter.tsx` con una etiqueta de acción opcional (`actionLabel`, default "Actualizar filtros") para que el estado vacío de filtros pueda ofrecer "Limpiar filtros" sin duplicar el componente (FR-011, FR-012). *(ID añadido tras `/speckit.analyze`; se ejecuta dentro de esta fase, antes de T018.)*

**Checkpoint**: User Story 1 totalmente funcional y probable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Ver solo las sesiones recientes (Priority: P1)

**Goal**: Control de rango temporal predefinido evaluado sobre `time.updated`, con ventana rodante en vivo que recompone la lista sin recargar.

**Independent Test**: Abrir el listado con sesiones de hoy y antiguas, elegir "Últimas 24 horas" y comprobar que solo quedan las recientes; con "Última hora" activo, una sesión que cruza el límite desaparece en menos de 5 s sin tocar nada.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Escribir `src/Domains/Sessions/Components/specs/TimeRangeFilter.spec.tsx`: las cinco opciones (Última hora, Últimas 24 horas, Últimos 7 días, Últimos 30 días, Todo), valor activo reflejado y `onChange(range)`
- [X] T020 [P] [US2] Ampliar `src/Domains/Sessions/Pages/specs/SessionList.page.spec.tsx` con la recomposición en vivo: con rango acotado, avanzar temporizadores falsos hace desaparecer una sesión que cruza el límite (FR-022, SC-007). **Incluye** cablear `range` y `setRange` de `useSessionFilters` en `SessionList.page.tsx` (`range={range}` / `onRangeChange={setRange}`): T018 solo pasó las props de US1, así que sin este cableado `TimeRangeFilter` no se monta y US2 no funciona de extremo a extremo. *(Hueco detectado durante la implementación de T023.)*

### Implementation for User Story 2

- [X] T021 [US2] Extender `src/Application/Components/Molecules/Select.tsx` para hacer `defaultValue` **opcional**, añadir un `value` controlado y un `className` que se aplique al `SelectTrigger` interno (que hoy fija `w-20`; verificar que "Últimas 24 horas" entra sin recorte), y usar `value` como key en lugar de `uuid()` (necesario para reflejar el rango desde la URL y limpiar filtros)
- [X] T022 [US2] Crear `src/Domains/Sessions/Components/TimeRangeFilter.tsx` reutilizando `Select` y `TIME_RANGES`, reflejando el valor activo y anunciándolo (FR-006–FR-009, FR-021)
- [X] T023 [US2] Actualizar `src/Domains/Sessions/Components/SessionFilterBar.tsx` para renderizar `TimeRangeFilter` y cablear `range` / `onRangeChange`
- [X] T024 [US2] Actualizar `src/Domains/Sessions/Components/index.ts` para exportar `TimeRangeFilter`

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente; la lista se recompone en vivo con rangos acotados.

---

## Phase 5: User Story 3 - Conservar los filtros al entrar y salir de una sesión (Priority: P2)

**Goal**: Los filtros viven en la dirección de la página (sobreviven a navegar, recargar y compartir), se degradan sin error ante valores inválidos y hay una acción siempre visible para limpiarlos.

**Independent Test**: Aplicar un filtro de proyecto, abrir una sesión, volver al listado y comprobar que el filtro sigue aplicado; recargar o abrir la URL en otra pestaña reproduce la misma selección; "Limpiar filtros" devuelve el listado completo y deja la dirección sin filtros.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Ampliar `src/Domains/Sessions/Components/specs/SessionFilterBar.spec.tsx` con el resumen (`N proyectos · <etiqueta de rango>`) y la acción "Limpiar filtros" visibles solo con filtros activos (FR-025, SC-006)
- [X] T026 [P] [US3] Ampliar `src/Domains/Sessions/Pages/specs/SessionList.page.spec.tsx` con `initialEntries` que incluyan filtros: restauración al abrir la URL, y degradación sin error ante `projects` inexistente o `range` inválido (FR-013–FR-015, SC-003)

### Implementation for User Story 3

- [X] T027 [US3] Actualizar `src/Domains/Sessions/Components/SessionFilterBar.tsx` para mostrar el resumen de lo seleccionado y la acción "Limpiar filtros" (`Button variant="link"`) mientras `hasActiveFilters` (FR-012, FR-025, SC-006)
- [X] T028 [US3] Actualizar `src/Domains/Sessions/Pages/SessionList.page.tsx` para pasar `hasActiveFilters` y `onClear` (de `useSessionFilters`) a la barra (FR-012)
- [X] T033 [P] [US3] Ampliar `src/Domains/Sessions/Pages/specs/SessionList.page.spec.tsx` con el ida-y-vuelta: partir de `/sessions?projects=<dir>&range=24h`, navegar a `/sessions/<id>` y volver, y comprobar que los filtros siguen aplicados (FR-026, SC-003). *(ID añadido tras `/speckit.analyze`; se ejecuta dentro de esta fase.)*
- [X] T034 [US3] Corregir `src/Domains/Sessions/Pages/SessionList.page.tsx` para pasar `validSelected` (no `selectedProjects`) a `SessionFilterBar`: un proyecto inexistente en la dirección se ignora y el resumen debe mostrar `Todos`, no `1 proyecto` (FR-003, FR-015). *(ID añadido durante la implementación: hueco detectado en T026.)*

**Checkpoint**: Las tres historias funcionan de forma independiente y los filtros persisten en la URL.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accesibilidad, no-regresión y puerta de calidad del repo.

- [X] T029 [P] Añadir/verificar aserciones de accesibilidad en los specs de componentes: operación por teclado y anuncio de estado de `Checkbox`/`Select`/disparador (FR-021)
- [X] T030 [P] Confirmar 0 regresiones sin filtros (SC-004) ejecutando `npx vitest run src/Domains/Sessions`, `npm test`, `npm run tsc` y `npm run lint`, y corregir lo que aparezca
- [X] T031 Ejecutar la validación automatizada de `specs/005-session-filters/quickstart.md` (§1) y actualizar el quickstart si alguna ruta cambió

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** las tres historias.
- **User Stories (Phase 3–5)**: dependen de Foundational.
  - Pueden ir en paralelo si hay personal, o secuencialmente por prioridad (P1 → P1 → P2).
  - US2 y US3 editan ficheros creados por US1 (`SessionFilterBar.tsx`, spec de barra y spec de página): en solitario, ejecutar en orden US1 → US2 → US3.
- **Polish (Phase 6)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencias de otras historias. **MVP**.
- **US2 (P1)**: tras Foundational. Independiente en comportamiento; reutiliza la barra creada en US1 (edición secuencial del mismo fichero).
- **US3 (P2)**: tras Foundational. La persistencia en URL ya la aporta el hook fundacional (R1); US3 añade la acción de limpiar visible y endurece la validación/restauración con specs de integración.

### Within Each User Story

- Tests primero y fallando; después modelos/componentes; luego servicios/hook; por último integración de página.
- `SessionList` (conteo) antes de la página; `ProjectFilter`/`TimeRangeFilter` antes de la barra; barra antes de la página.

### Parallel Opportunities

- Setup: T001 y T002 en paralelo.
- Foundational: T004, T006 y T008 en paralelo (ficheros de spec distintos, contrato congelado); T003, T005 y T007 son secuenciales entre sí.
- US1: T010–T013 (specs) en paralelo; T014 (ProjectFilter) en paralelo con T015 (SessionList) y T032 (EmptyScreenFilter, fichero compartido distinto).
- US2: T019 y T020 en paralelo.
- US3: T025, T026 y T033 en paralelo.
- Polish: T029 y T030 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Lanzar juntos los specs de US1 (contrato ya congelado):
Task: "ProjectFilter.spec.tsx en src/Domains/Sessions/Components/specs/"
Task: "SessionFilterBar.spec.tsx en src/Domains/Sessions/Components/specs/"
Task: "Actualizar SessionList.spec.tsx (conteo) en src/Domains/Sessions/Components/specs/"
Task: "SessionList.page.spec.tsx en src/Domains/Sessions/Pages/specs/"

# Lanzar juntos los componentes sin conflicto de fichero:
Task: "ProjectFilter.tsx en src/Domains/Sessions/Components/"
Task: "SessionList.tsx (conteo) en src/Domains/Sessions/Components/"
```

## Parallel Example: Foundational

```bash
# Tras crear el módulo puro (T003), lanzar sus specs y los del reloj/hook:
Task: "sessionFilters.spec.ts en src/Domains/Sessions/lib/specs/"
Task: "useNow.spec.tsx en src/Domains/Sessions/Hooks/specs/"
Task: "useSessionFilters.spec.tsx en src/Domains/Sessions/Hooks/specs/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1 (Setup).
2. Completar Fase 2 (Foundational) — **crítico**, bloquea todo.
3. Completar Fase 3 (US1): filtro de proyecto + barra + página.
4. **PARAR y VALIDAR**: probar US1 de forma independiente (seleccionar/desmarcar proyectos).
5. Demo si está listo: ya entrega valor (vista acotada por proyecto).

### Incremental Delivery

1. Setup + Foundational → lógica pura y hook de estado listos.
2. US1 → validar → demo (MVP).
3. US2 → validar rango + ventana en vivo → demo.
4. US3 → validar persistencia + limpiar → demo.
5. Cada historia añade valor sin romper las anteriores.

### Parallel Team Strategy

1. El equipo completa Setup + Foundational en conjunto.
2. Tras Foundational:
   - Dev A: US1 (componentes + página).
   - Dev B: US2 (Select controlado + TimeRangeFilter).
   - Dev C: US3 (resumen + limpiar).
3. Por la edición secuencial de `SessionFilterBar.tsx` y de los specs de barra/página, integrar en orden US1 → US2 → US3.

---

## Notes

- `[P]` = ficheros distintos, sin dependencias de tareas incompletas.
- `[Story]` mapea cada tarea a su historia para trazabilidad.
- Sin dependencias nuevas; sin cambios en `Sessions.service.ts`, `queryKeys.ts`, `Session.entity.ts`, `useRootSessions.ts`, el reducer SSE ni `Infrastructure` (R10).
- Filtros **solo** en la página del listado; el listado lateral del espacio de trabajo queda intacto (FR-018).
- Sin filtros activos, `filteredGroups` debe ser idéntico a `groups` (SC-004).
- Commit tras cada tarea o grupo lógico, siguiendo Conventional Commits.
- **Remediación tras `/speckit.analyze` (2026-10-07)**: se añadieron T032 (etiqueta de acción en `EmptyScreenFilter`, FR-011/FR-012) y T033 (test de ida-y-vuelta, FR-026/SC-003); se precisaron T007 (firma `useSessionFilters(groups)` y `clearFilters` acotado a `projects`/`range`) y T021 (`defaultValue` opcional + `className` al trigger). Total: **33 tareas**.

---

## Phase 7: Convergence

**Purpose**: Cerrar los huecos detectados al contrastar el código real del repositorio contra `spec.md`, `plan.md` y las tareas previas (todos los IDs existentes estaban marcados como completados). Assessment 2026-10-07: 26 FR + 8 SC + 9 decisiones de plan + 8 principios de constitución revisados; 2 hallazgos accionables.

- [X] T035 Refrescar `now` al activarse el reloj en `src/Domains/Sessions/Hooks/useNow.ts` (en la transición `active` de `false` a `true`, fijar `setNow(Date.now())` antes de arrancar el intervalo) para que la primera evaluación de un rango acotado no use un instante obsoleto desde el montaje; ampliar `src/Domains/Sessions/Hooks/specs/useNow.spec.tsx` con el caso "activación tras tiempo inactivo evalúa contra la hora actual" per FR-022 (partial)
- [X] T036 Acotar el conteo de sesiones por grupo (FR-016) a la página del listado: `src/Domains/Sessions/Components/SessionList.tsx` añade el conteo y hoy también lo muestra el listado lateral del espacio de trabajo (`src/Infrastructure/WorkspacePage.tsx`), que FR-018 exige "sin cambios"; exponer el conteo como opt-in (p. ej. una prop `showCount` que la página active y el rail no) o justificar la excepción, y actualizar `src/Domains/Sessions/Components/specs/SessionList.spec.tsx` per FR-018 (contradicts)
