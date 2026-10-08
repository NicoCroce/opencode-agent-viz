# Specification Quality Checklist: Filtros de proyecto y recencia en el listado de sesiones

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validación inicial aprobada en la primera pasada; no se requirieron iteraciones.
- Decisiones cerradas con el usuario antes de redactar (2026-10-07):
  - Alcance de los filtros: solo la página del listado de sesiones; el listado lateral del espacio de trabajo no cambia (FR-018).
  - Filtro de proyecto: multi-selección, con "todos" cuando no hay marcas (FR-002, FR-003, Assumptions).
  - Filtro temporal: rangos predefinidos, sin selector de fechas (FR-007, Assumptions).
  - Persistencia: reflejada en la dirección de la página (FR-013, FR-014).
- Clarificaciones resueltas en la sesión del 2026-10-07 (4 preguntas, 4 respondidas), todas integradas al spec:
  - Recencia por última actividad de la sesión, no por creación (FR-009).
  - Ventana rodante en vivo, reevaluada contra la hora actual (FR-022, SC-007).
  - Etiqueta de proyecto = nombre de carpeta + ruta completa, para resolver homónimos (FR-023, SC-008).
  - Controles en barra siempre visible sobre el listado, con resumen y acción de limpiar a la vista (FR-024, FR-025).
- Nuevas obligaciones derivadas: FR-022 a FR-025; escenarios 6 y 7 en US2; escenario 6 en US1; cuatro edge cases nuevos; SC-007 y SC-008.
- **Remediación tras `/speckit.analyze` (2026-10-07)**: 7 hallazgos corregidos.
  - C1 (HIGH) → nuevo FR-026 + tarea T033 (test de ida-y-vuelta). Se verificó en código que la ruta de detalle sí existe (`GRAPH_VIEW_ROUTE = '/sessions/:id'` montada en `Infrastructure/Routes.tsx`), contra lo afirmado por el análisis.
  - U1 (MEDIUM) → firma `useSessionFilters(groups: TSessionGroup[])` fijada en plan.md y T007, con una única suscripción en la página.
  - A1 (MEDIUM) → FR-004 y US1 esc.5 reescritos: las opciones salen del catálogo, con independencia del rango temporal.
  - F1 (MEDIUM) → US2 esc.5 ya no menciona un "total" global inexistente; habla del conteo del grupo.
  - U5 (LOW) → `clearFilters` acotado a `projects` y `range` en T007.
  - U2 (LOW) → T021 precisa `defaultValue` opcional y el destino de `className` (el trigger).
  - U3 (LOW) → T032 extiende `EmptyScreenFilter` con etiqueta de acción opcional.
  - Descartados por cosméticos: F2, F3, C2, C3, U4.
