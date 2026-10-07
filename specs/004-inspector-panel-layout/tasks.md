---
description: "Task list — Reordenar y agrupar el panel de detalles (Inspector)"
---

# Tasks: Reordenar y agrupar el panel de detalles

**Input**: Design documents from `/specs/004-inspector-panel-layout/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Incluidos. El plan (sección *Testing*) y la constitución (Principio VIII) exigen specs junto al código, y `quickstart.md` requiere la suite en verde. Las tareas de test se escriben primero y deben fallar antes de implementar.

**Organization**: Agrupadas por user story para permitir implementación y prueba independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada tarea

## Path Conventions

- **Single project / frontend SPA**: el código vive en `src/Domains/Inspector/`. Los specs van en `src/Domains/Inspector/Components/specs/` (junto al código, Principio VIII).
- No hay backend: el servidor de OpenCode es externo y ya existe.

> **Nota de single-writer**: `InspectorPanel.tsx` y `InspectorPanel.spec.tsx` los editan varias fases. Aunque cada tarea es paralelizable dentro de su fase, esos dos archivos se modifican en secuencia (`T012 → T018 → T022` y `T009 → T015 → T020`). No los edites en paralelo entre fases.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar el punto de partida y blindar el alcance de una feature de pura presentación.

- [X] T001 Verificar el estado base en la rama `004-inspector-panel-layout`: `pnpm lint`, `pnpm tsc` y `pnpm test` deben estar en verde antes de tocar el dominio `Inspector`.
- [X] T002 [P] Confirmar el alcance congelado: no se añaden dependencias y NO se modifican `Inspector.entity.ts`, `Inspector.service.ts`, `Hooks/useInspectorData.ts`, `lib/medianToolDurations.ts` (+ su spec), `Domains/queryKeys.ts`, `Infrastructure/` ni el reducer/SSE. `medianToolDurations()` ya existe y se reutiliza, no se reimplementa.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extraer "Duración mediana por herramienta" de `ToolHistory` a una sección propia. Es un prerrequisito compartido: US1 la necesita como sección top-level (FR-006) y US2 necesita que `ToolHistory` ya no la incluya (FR-013).

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T003 [P] Crear la sección `ToolStats` en `src/Domains/Inspector/Components/ToolStats.tsx`: props `{ tools: TToolHistoryEntry[]; isEmptyLabel?: string }`; encabezado visible `Duración mediana por herramienta`; calcula con la función pura existente `medianToolDurations(tools)`; cada fila muestra `` `${stat.name} · ${callsLabel(stat.calls)}` `` y `formatDuration(stat.medianMs)` o `"no disponible"` si `medianMs === null`; estado vacío explícito (default `"Sin actividad de herramientas todavía."`). Reutiliza `formatDuration` de `@app/Application/Helpers`.
- [X] T004 [P] Quitar el bloque de mediana de `src/Domains/Inspector/Components/ToolHistory.tsx`: eliminar el `<Container data-testid="tool-history-stats">`, el import de `medianToolDurations` y el helper `callsLabel`. Conservar solo la lista de ejecuciones (estado + duración) y el control `Ver N más` (FR-013).
- [X] T005 [P] Crear `src/Domains/Inspector/Components/specs/ToolStats.spec.tsx` y trasladar aquí los tests de mediana hoy en `ToolHistory.spec.tsx`: conteo de llamadas (`read · 2 llamadas`, `bash · 1 llamada`), duración mediana (`500ms`, `100ms`), `"no disponible"` para herramientas sin tiempos y estado vacío.
- [X] T006 [P] Actualizar `src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx`: eliminar los tests de estadísticas/mediana; conservar los de estado vacío, render de 10 entradas, control `Ver N más` y expandir/colapsar.

**Checkpoint**: `ToolStats` existe y está testeada; `ToolHistory` ya no muestra la mediana. Las user stories pueden empezar.

---

## Phase 3: User Story 1 - Orden predecible de las secciones (Priority: P1) 🎯 MVP

**Goal**: Reordenar el panel para que, con un nodo seleccionado, las secciones de datos aparezcan de arriba a abajo: identidad → `Modelo` → `Métricas` (con el aviso de Loop dentro) → `Recursos` → `Duración mediana por herramienta` → `Subagentes` → `Archivos`.

**Independent Test**: Seleccionar un nodo y comprobar por orden del DOM las secciones `Modelo` → `Métricas` → `Recursos` → `Duración mediana por herramienta` → `Subagentes` → `Archivos`, y que el aviso de Loop aparece dentro de `Métricas`. (La sección `Avanzado` se añade al final en US2, FR-010.)

> **Transición de contenido**: en esta fase `AnswersSection`, `QuestionsSection`, `ToolHistory` y los errores se desmontan del nivel superior (hoy aparecen arriba). Se reintroducen dentro de `Avanzado` en US2 (FR-010..FR-015). El criterio SC-004 se cumple al cerrar US2.

### Tests for User Story 1 ⚠️

> **NOTE: Escribir estos tests primero y confirmar que FALLAN antes de implementar.**

- [X] T007 [P] [US1] Crear `src/Domains/Inspector/Components/specs/ModelSection.spec.tsx`: encabezado `Modelo`, fila `Nombre` = `providerID/id` y `Razonamiento` = variante, con `UNAVAILABLE` cuando faltan.
- [X] T008 [P] [US1] Crear `src/Domains/Inspector/Components/specs/MetricsSection.spec.tsx`: con `metrics.hasLoop === true` el aviso de Loop (`LoopBadge`, `retryCount`/`loopEvidence`) se renderiza dentro de `Métricas`; con `hasLoop === false` no aparece.
- [X] T009 [P] [US1] Actualizar `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`: assertar el orden del DOM de las secciones de datos y que Loop queda dentro de `Métricas`. Mover los asserts de `Respuestas`, toggle de razonamiento, `Ver histórico completo` y `En paralelo` a los flujos de US2/US3 (quedan cubiertos allí).

### Implementation for User Story 1

- [X] T010 [P] [US1] Crear `src/Domains/Inspector/Components/ModelSection.tsx`: props `{ model: TGraphNode['data']['model'] }`; encabezado `Modelo`; filas `Nombre` y `Razonamiento` con el estilo de encabezado ya usado (`text-[11px] font-medium uppercase tracking-wide text-muted-foreground`) y filas monoespaciadas (`DetailRow`).
- [X] T011 [P] [US1] Actualizar `src/Domains/Inspector/Components/MetricsSection.tsx` para renderizar `LoopBadge` (con `metrics.retryCount` y `metrics.loopEvidence`) cuando `metrics.hasLoop` sea `true` (FR-004). Mantener duración, costo, invocaciones y tokens.
- [X] T012 [US1] Reescribir `src/Domains/Inspector/Components/InspectorPanel.tsx` con el orden exacto: cabecera de identidad (sin cambios, FR-002) → `ModelSection` → `MetricsSection` → `ResourceList` → `ToolStats` → un bloque `Subagentes` **temporal inline** (un único encabezado `Subagentes` que agrupa tareas del subagente y agentes en paralelo; se extrae a `SubagentsSection` en US3) → `FileChanges`. Eliminar el `Modelo` inline, el `LoopBadge` top-level, `AnswersSection`, `QuestionsSection`, `ToolHistory` y el bloque de `Errores` del nivel superior. Sin `order-*`/`flex-col-reverse`. (depende de T010, T011)

**Checkpoint**: Con un nodo, las secciones de datos se leen en el orden pedido y el Loop vive dentro de `Métricas`. US1 es desplegable como MVP.

---

## Phase 4: User Story 2 - "Avanzado" colapsado por defecto (Priority: P1)

**Goal**: Agrupar el contenido técnico (`Herramientas` → `Respuestas` → `Preguntas y permisos` → `Errores`) dentro de un desplegable `Avanzado` cerrado por defecto, expandible por acción explícita y conservado entre cambios de nodo.

**Independent Test**: Seleccionar un nodo y comprobar que `Herramientas`, `Respuestas`, `Preguntas y permisos` y `Errores` no están en el DOM hasta expandir `Avanzado`; al expandirlo aparecen en ese orden, y al colapsarlo vuelven a desaparecer sin alterar el resto del panel.

### Tests for User Story 2 ⚠️

- [X] T013 [P] [US2] Crear `src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx`: colapsado por defecto (sin `children` montados), el control tiene nombre accesible `Avanzado` con `aria-expanded="false"` y `aria-controls` apuntando a la región; al pulsar monta los `children` y pasa a `aria-expanded="true"`; al colapsar los desmonta; acepta `defaultExpanded` y modo controlado opcional (contrato 3.1).
- [X] T014 [P] [US2] Crear `src/Domains/Inspector/Components/specs/ErrorsSection.spec.tsx`: encabezado `Errores`; `errors` vacío → `"Sin errores."`; con errores, una fila por mensaje con estilo `text-status-error`.
- [X] T015 [P] [US2] Ampliar `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`: (a) `AdvancedSection` colapsado por defecto — `Herramientas`/`Respuestas`/`Preguntas y permisos`/`Errores` NO presentes; (b) al expandir aparecen en ese orden exacto; (c) `aria-expanded` alterna; (d) al colapsar desaparecen y el orden del resto no cambia; (e) el estado de expansión se conserva al cambiar de nodo sin desmontar el panel; (f) reintroducir bajo el estado expandido los asserts de `Respuestas`, toggle de razonamiento, `Ver histórico completo`.

### Implementation for User Story 2

- [X] T016 [P] [US2] Crear `src/Domains/Inspector/Components/AdvancedSection.tsx`: disclosure accesible con `Button` (nombre `Avanzado`, `aria-expanded`, `aria-controls`), región `role="region"` con `id` y `aria-label`, **render condicional** de `children` (no se montan colapsados), estado local no controlado `useState(false)` + props opcionales `defaultExpanded`/`expanded`/`onToggle`. Sin dependencias nuevas; estilo de fila sin caja (coherente con `ToolHistory`).
- [X] T017 [P] [US2] Crear `src/Domains/Inspector/Components/ErrorsSection.tsx`: props `{ errors: { message: string; at: number }[] }`; encabezado `Errores`; vacío → `"Sin errores."`; cada error con `text-status-error` (extrae el bloque hoy inline en `InspectorPanel`).
- [X] T018 [US2] Conectar en `src/Domains/Inspector/Components/InspectorPanel.tsx`: añadir `<AdvancedSection>` como última sección, con children en orden `ToolHistory` → `AnswersSection` → `QuestionsSection` → `ErrorsSection` (FR-011). Restaurar el cableado de respuestas/razonamiento: `useReasoningVisibility`, props `showReasoning`/`onToggleReasoning`/`onOpenHistory`, `sessionId` y `renderCompactionContext` (`CompactionContext` + `context` de `useInspectorData`). (depende de T016, T017)

**Checkpoint**: El panel conserva el 100% del contenido (SC-004) y el técnico queda oculto por defecto tras `Avanzado` (SC-002). US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - "Subagentes" agrupa tareas y paralelismo (Priority: P2)

**Goal**: Mostrar las tareas delegadas y los agentes en paralelo bajo un único encabezado `Subagentes`, con estado vacío explícito.

**Independent Test**: Seleccionar un nodo con tareas de subagente y/o peers en paralelo y comprobar que ambos contenidos conviven bajo el único encabezado `Subagentes`; con un nodo sin ninguno, `Subagentes` muestra un estado vacío explícito sin desaparecer.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] Crear `src/Domains/Inspector/Components/specs/SubagentsSection.spec.tsx`: encabezado único `Subagentes`; tareas (estado + descripción) y peers (`StatusDot` + título) bajo ese encabezado; con ambos vacíos → estado vacío explícito `"Sin subagentes ni agentes en paralelo."`.
- [X] T020 [P] [US3] Ampliar `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`: el bloque `Subagentes` usa un solo encabezado (ya no `En paralelo (N)` ni `Tareas del subagente`), muestra peers y tareas juntos, y muestra el estado vacío cuando no hay ninguno.

### Implementation for User Story 3

- [X] T021 [P] [US3] Crear `src/Domains/Inspector/Components/SubagentsSection.tsx`: props `{ tasks: TTaskEntry[]; parallelPeers: TGraphNode[] }`; encabezado único `Subagentes`; renderiza tareas (estado + descripción) y peers (`StatusDot` + título); ambos vacíos → `"Sin subagentes ni agentes en paralelo."` (FR-007/FR-008).
- [X] T022 [US3] Reemplazar el bloque `Subagentes` inline de `src/Domains/Inspector/Components/InspectorPanel.tsx` por `<SubagentsSection tasks={tasks} parallelPeers={parallelPeers} />`, conservando su posición entre `ToolStats` y `FileChanges`. (depende de T021)

**Checkpoint**: Las tres user stories funcionan de forma independiente y el panel mantiene el orden completo.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Registro de exports, verificación final y validación end-to-end.

- [X] T023 [P] Exportar los componentes nuevos en `src/Domains/Inspector/Components/index.ts`: `ModelSection`, `ToolStats`, `SubagentsSection`, `AdvancedSection`, `ErrorsSection`.
- [X] T024 Ejecutar la puerta de calidad completa: `pnpm lint`, `pnpm tsc`, `pnpm test` y `pnpm build`. Corregir cualquier regresión.
- [X] T025 [P] Recorrer los criterios de `specs/004-inspector-panel-layout/quickstart.md` (US1/US2/US3 + edge cases) y confirmar que no quedan referencias al `data-testid="tool-history-stats"` eliminado ni al encabezado `En paralelo`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las user stories.
- **User Stories (Phase 3+)**: dependen de Foundational. Se pueden trabajar en paralelo (con capacidad) o en secuencia P1 → P1 → P2.
- **Polish (Phase 6)**: depende de que las historias deseadas estén completas.

### User Story Dependencies

- **US1 (P1)**: puede empezar tras Foundational. No depende de otras historias.
- **US2 (P1)**: puede empezar tras Foundational. Reintroduce el contenido técnico que US1 desmonta; depende de US1 solo para el ensamblaje del panel (`InspectorPanel.tsx`), no de su lógica.
- **US3 (P2)**: puede empezar tras Foundational. Sustituye el bloque inline que US1 dejó; depende de US1 para el punto de composición del panel.

### Within Each User Story

- Tests primero (deben fallar) → componentes → integración en `InspectorPanel`.
- Los componentes nuevos son independientes entre sí (`[P]`); la integración en `InspectorPanel.tsx` es de un solo escritor y va última.

### Parallel Opportunities

- Setup: T002.
- Foundational: T003–T006 en paralelo (archivos distintos).
- US1: T007–T011 en paralelo; T012 al final.
- US2: T013–T017 en paralelo; T018 al final.
- US3: T019–T021 en paralelo; T022 al final.
- Polish: T023 y T025 en paralelo con T024.

---

## Parallel Example: Foundational (Fase 2)

```bash
# Extracción de la mediana a su sección propia (archivos distintos):
Task: "Create src/Domains/Inspector/Components/ToolStats.tsx"          # T003
Task: "Strip median block from src/Domains/Inspector/Components/ToolHistory.tsx"  # T004
Task: "Create src/Domains/Inspector/Components/specs/ToolStats.spec.tsx"          # T005
Task: "Update src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx"        # T006
```

## Parallel Example: User Story 1 (Fase 3)

```bash
# Tests + componentes independientes (archivos distintos):
Task: "Create .../specs/ModelSection.spec.tsx"      # T007
Task: "Create .../specs/MetricsSection.spec.tsx"    # T008
Task: "Update .../specs/InspectorPanel.spec.tsx"    # T009
Task: "Create .../Components/ModelSection.tsx"      # T010
Task: "Update .../Components/MetricsSection.tsx"    # T011
# Luego, en secuencia:
Task: "Rewrite .../Components/InspectorPanel.tsx (order)"  # T012
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Setup + Foundational.
2. Completar US1 → validar el orden de las seis secciones + Loop en `Métricas`.
3. **STOP and VALIDATE** con `InspectorPanel.spec.tsx`.
4. Deploy/demo si está listo (MVP del reordenamiento).

### Incremental Delivery

1. Foundational → `ToolStats` extraída (base compartida).
2. US1 → orden de las secciones de datos (MVP).
3. US2 → `Avanzado` colapsado + contenido técnico reintroducido (cierra el 100% de contenido, SC-004).
4. US3 → `Subagentes` agrupado.
5. Polish → exports + puerta de calidad + quickstart.

### Milestone P1

US1 + US2 (ambas P1) constituyen el resultado completo pedido: orden correcto **y** "Avanzado" colapsado por defecto. US3 es la mejora P2.

---

## Notes

- `[P]` = archivos distintos y sin dependencia de tareas incompletas.
- Tests primero: escribir y confirmar fallo antes de implementar (TDD del repo).
- `InspectorPanel.tsx` y `InspectorPanel.spec.tsx`: single-writer, edición secuencial entre fases.
- Feature de pura presentación: no tocar datos, SDK, hooks ni SSE (Principios I, III, VII).
- Sin dependencias nuevas: el disclosure se construye con `Button` + `useState` (mismo patrón que `ToolHistory`/`FileChanges`).
- Cada sección conserva su ciclo error → loading → vacío → datos (FR-016, Principio VI); `SubagentsSection`, `ErrorsSection` y `ToolStats` incluyen estado vacío explícito.
- Commitear por tarea o grupo lógico con Conventional Commits.
