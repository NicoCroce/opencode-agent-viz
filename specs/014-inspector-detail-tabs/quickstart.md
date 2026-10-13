# Quickstart — Validación de `014-inspector-detail-tabs`

**Feature**: `014-inspector-detail-tabs` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md)

Guía de validación reproducible. Prerrequisitos: dependencias instaladas (`pnpm install`).
Todos los comandos se ejecutan desde la raíz del repo.
Detalle de invariantes en [data-model.md](./data-model.md) y
[contracts/inspector-section-tabs-contract.md](./contracts/inspector-section-tabs-contract.md).

## Escenario 0 — Estado previo (hoy el desplegable manda)

```bash
pnpm test -- src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx
pnpm test -- src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx
```

**Esperado (pre-implementación)**: ambos specs **no existen** todavía; al añadirlos deben fallar
hasta que existan el hook y el componente (rojo → verde, Principio V/VIII). Sirve para fijar el
contrato antes del código.

## Escenario 1 — Las siete secciones, por separado y sin paso previo (US1, US2 / FR-001..FR-003)

```bash
pnpm test -- src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx \
  src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx
```

**Esperado**:
- 7 items en el orden Subagentes · Archivos · Herramientas · Respuestas · Preguntas y permisos ·
  Errores · Latencia; la activa inicial es `subagents`.
- Exactamente un `tabpanel` con hijos; los otros 6 están `hidden` y **sin hijos montados**.
- `setTab` ignora ids inválidos.
- Sin ningún control que haya que expandir: no queda `aria-expanded` ni `role="region"` de
  "Avanzado" en el detalle.

## Escenario 2 — Teclado, foco y ancho del panel (US4, US5, US7 / FR-006, FR-007, FR-013)

```bash
pnpm test -- src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx \
  src/Application/Components/ui/specs/tabs.a11y.spec.tsx
```

**Esperado**:
- ←/→ mueven y activan la selección; `Inicio`/`Fin` van a la primera/última con 7 pestañas.
- El fixture **anidado** (dos tablists con `aria-label` distintos e ids únicos) no rompe el patrón.
- Guardias de clase del primitivo: `flex-wrap` y `min-h-control` en la lista (sin `h-control`),
  `whitespace-nowrap` en los triggers, foco por `outline` + `forced-colors:outline-[Highlight]`,
  indicador activo con la clase de contraste, y **ningún** `display` en el `className` de un
  `TabsContent`.

## Escenario 3 — Ningún falso "vacío" mientras la fuente carga o falla (US6 / FR-008)

```bash
pnpm test -- src/Domains/Inspector/Components/specs/SubagentsSection.spec.tsx \
  src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx \
  src/Domains/Inspector/Components/specs/AnswersSection.spec.tsx \
  src/Domains/Inspector/Components/specs/ErrorsSection.spec.tsx
```

**Esperado**: con `isError` se ve el estado de error y **no** el vacío; con `isLoading` se ve el
estado de carga y **no** el vacío; el vacío legítimo (fuente resuelta sin datos) sigue igual.
En `AnswersSection`, la cabecera con el toggle de razonamiento y el botón "Ver histórico completo"
permanecen montados en los cuatro estados.

## Escenario 4 — Resumen continuo, sin duplicados ni "Avanzado" (US3 / FR-004, FR-005, FR-010)

```bash
pnpm test -- src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx \
  src/Domains/Inspector/Components/specs/LatencySection.spec.tsx
```

**Esperado**:
- Orden del resumen: Identidad → Modelo → Métricas → Contexto (Paralelismo + Aporte al padre) →
  Recursos → Duración mediana por herramienta, y el tablist después; **Contexto sigue presente**.
- Ninguna sección del resumen aparece dentro del área de pestañas y ninguna sección aparece dos
  veces.
- Latencia conserva referencia de umbral, control y listado de anomalías (y sigue operativa con
  anomalías presentes).
- `AdvancedSection` ya no existe en el repo (`rg AdvancedSection src` sin resultados de producto).

## Escenario 5 — Sin regresión del tablist externo ni de la navegación móvil (FR-011, FR-012 / SC-004)

```bash
pnpm test -- src/Infrastructure/Components/specs/InspectorPane.spec.tsx \
  src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx \
  src/Infrastructure/Components/specs/WorkspaceMobileTabs.spec.tsx \
  src/Infrastructure/Hooks/specs/useDetailTabs.spec.tsx
```

**Esperado**: `Detalle | Chat` conserva etiqueta, orden, `aria-label`, roving tabindex y badge de
atención; en móvil, el mismo detalle ofrece las siete pestañas sin lista de destinos adicional.
Las queries globales quedan acotadas por `aria-label`/`data-testid`/`within` (el anidamiento de
dos tablists es ahora el caso normal).

## Escenario 6 — Batería completa y estáticos (cierre)

```bash
pnpm test
pnpm tsc
pnpm tsc:node
pnpm lint
```

**Esperado**: batería completa verde sin regresiones; `tsc`, `tsc:node` y `lint` limpios.

## Escenario 7 — Verificación en navegador (deuda explícita del run)

Los ratios renderizados, `forced-colors` real y el ancho de etiquetas **no** se pueden verificar en
jsdom. Antes de cerrar la feature, con `pnpm dev`:

1. Panel a **280 px** y a **720 px**: las siete etiquetas se leen completas y la lista envuelve en
   filas, sin recorte ni desplazamiento horizontal.
2. Tema oscuro (el servido) y tema claro: indicador activo distinguible; en claro se confirma que el
   texto inactivo sigue en 4.39:1 (hallazgo latente aceptado, sin token tocado).
3. Contraste forzado del sistema: activo y foco siguen distinguiéndose, pestaña a pestaña.
4. `Detalle | Chat`: revisión visual de que conserva su aspecto (hug, etiquetas, badge) tras el
   cambio del primitivo compartido.
5. Recorrido de teclado: `Tab` entra al tablist, ←/→/`Inicio`/`Fin` cambian la sección, y el foco
   vuelve a ser visible.

## Criterios de aceptación cubiertos

| Escenario | US / FR | SC |
|---|---|---|
| 0–1 | US1, US2 / FR-001, FR-002, FR-003 | SC-001, SC-002 |
| 2 | US4, US5, US7 / FR-006, FR-007, FR-013 | SC-003, SC-006 |
| 3 | US6 / FR-008 | SC-005 |
| 4 | US3 / FR-004, FR-005, FR-009, FR-010 | SC-002 |
| 5 | FR-011, FR-012 | SC-004 |
| 6 | FR-001..FR-013 (no regresión) | SC-001..SC-006 |
| 7 | FR-006, FR-007, FR-011 | SC-003, SC-006 |

## Fuera de esta guía

No se incluye código de implementación, cuerpos de componentes ni la suite completa: eso pertenece
a `tasks.md` (Phase 2) y a la fase de implementación.
