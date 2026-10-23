# Implementation Plan: Panel de eficiencia de sesión

**Branch**: `015-session-efficiency-panel` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-session-efficiency-panel/spec.md`

**Insumos**: [discovery/prd.md](./discovery/prd.md), [discovery/rfc.md](./discovery/rfc.md)
(decisiones `sddorch/20261023-eficiencia-sesion/decision/*`, no se reabren) y
`.specify/memory/constitution.md` (principios I–VIII).

## Summary

Añadir un **overlay de análisis de eficiencia por sesión**, abierto desde la cabecera del grafo
(botón `Eficiencia`, antes de `Seguir`), que mide la **entrada humana** y la **respuesta** de la
sesión raíz y todo su subárbol, y devuelve:

1. Un veredicto entero 0–100 con banda, **cobertura** y **confianza**, más 2–3 factores de impacto
   con su conteo y su aporte (resta/suma).
2. Hallazgos accionables con evidencia (turno, mensaje, herramienta, hora y cita) y recomendación;
   las señales débiles van aparte y no puntúan.
3. La tabla cronológica de turnos (escritorio) / tarjetas (móvil), con prompt recortado a 120
   code points y expansión bajo demanda.
4. Totales de coste, tokens, caché, compactaciones, reintentos, errores y llamadas a herramientas,
   con **coste y latencia como contexto, nunca como puntuación**.
5. Un bloque "Cómo se calcula" con pesos, mínimos, indicadores, cobertura, confianza, bandas y
   omisiones.

El motor es **puro y determinista** (`lib/analyzeSession.ts`), consume `TSessionMessage[]`
(desde la caché de `sessions.messages(id)`, sin fetch) y no usa SDK, `Date.now()`, aleatoriedad ni
servicios externos.
El overlay usa **Radix Dialog** (focus trap, Escape, scroll-lock y retorno de foco), se monta como
slot de `WorkspaceView`/`WorkspaceLayout` y mantiene **exclusión mutua** con el histórico. No se
añade una 8.ª pestaña al Inspector (spec 014 fija 7), ni una ruta nueva, ni dependencias nuevas.

Enfoque fijado por el RFC y resuelto en [research.md](./research.md):

1. **Dominio nuevo** `src/Domains/Efficiency/`: entidad, hook de datos, motor puro por capas
   (`text`, `turns`, `rules`, `score`, `factors`, `omissions`) y componentes de presentación puros.
2. **Motor sobre `TSessionMessage[]`** (no `THistoryEntry`: perdería tokens/modelo/coste). Una
   pasada O(mensajes + herramientas), memoizada por identidades de datos; reloj inyectado y sin
   estado.
3. **Overlay en Infrastructure**: `EfficiencyOverlay` compone Radix Dialog + el hook del dominio;
   la página construye el mapa de sesiones del subárbol y cablea la exclusión mutua.
4. **Reutilización**: se conserva el resultado ya calculado de `summarizeSession` (vía
   `useWorkspaceSummary`), el tipo `TNodeMetrics` como contraste de totales, los `format*` y los
   componentes del barrel (`Container`, `Metric`, `DetailRow`, `SectionFrame`, `Disclosure`,
   `UnavailableValue`, `Alert`, `EmptyState`, `EmptyScreenError`). **No** se duplican
   `SessionSummaryBar`, `MetricsSection`, `ContextSection` ni `LatencySection`.

## Technical Context

**Language/Version**: TypeScript 5 strict sobre React 19 (Vite 8)

**Primary Dependencies**: React 19, TanStack Query 5 (`useQueries` sobre las claves existentes),
Radix Dialog (`@radix-ui/react-dialog` 1.1.x, instalado 1.1.23; ya es dependencia), Tailwind 4,
FontAwesome, Vitest + Testing Library + jsdom. **Sin dependencias nuevas.**

**Storage**: N/A — solo lectura; no hay persistencia, mutación, exportación ni claves nuevas. Se
reutiliza la caché de `sessions.messages(id)`.

**Testing**: Vitest (`vitest.config.ts`) + Testing Library. Specs en carpetas `specs/` junto al
código (Principio VIII): `.spec.ts` en `node` para el motor puro y `.spec.tsx` en `jsdom` para hook,
componentes y overlay. Se usan `createTestQueryClient`, `seed`, `renderWithProviders` y
`setupRadixUser` cuando el diálogo lo requiera.

**Target Platform**: SPA en navegador (escritorio y móvil; 320 px mínimo; temas claro, oscuro y
`forced-colors`; `prefers-reduced-motion`).

**Project Type**: single project (frontend React/Vite, sin backend propio).

**Performance Goals**: abrir con datos en **< 1 s** para una sesión de 200 mensajes y no congelar la
interfaz (SC-006). Una sola pasada O(n) memoizada por identidades; sin `JSON.stringify` repetido,
sin fetch, sin tick de reloj mientras el panel está abierto y sin re-layout del grafo
(Principio VII).

**Constraints**: solo lectura; sin LLM; sin escritura; sin comparación entre sesiones; sin ranking
ni percentiles; UI en español; determinista (mismos datos → mismo informe); sin cambios en
`queryKeys`, `buildHistory`, `summarizeSession`, `TGraphNodeData`, `sameNodeData` ni en la spec 014;
una sola capa superpuesta de este tipo a la vez; prompts truncados a 120 code points en colapsado y
completos solo en la región expandida (nunca en tooltip, nunca copiados por defecto).

**Scale/Scope**: 1 dominio nuevo (~9 módulos de `lib/`, ~12 componentes, 1 hook), 1 hook de UI y 1
overlay nuevos en Infrastructure, 4 componentes de Infrastructure modificados, ~10 specs nuevos de
dominio y ~5 specs de Infrastructure ajustados/nuevos; 0 rutas, 0 claves de caché nuevas, 0
dependencias nuevas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Veredicto |
|---|---|---|
| I. Observador con modo interactivo | El panel es solo lectura: no escribe, no muta, no exporta, no copia y no llama a servicios de escritura. No toca el acceso al dev server | PASS |
| II. Arquitectura por dominios | El motor y la presentación viven en `Domains/Efficiency/`; la composición cross-domain (grafo → sesiones del análisis) se hace en `Infrastructure/` (`WorkspacePage`, `EfficiencyOverlay`, `lib/buildEfficiencySessions`) y nunca desde un componente de un dominio hacia otro | PASS |
| III. Datos del servidor solo vía TanStack Query | El hook **no invoca el SDK**: observa la caché de TanStack Query con `useQueries` sobre `queryKeys.sessions.messages(id)` (clave existente) y `queryFn: skipToken`. No hay SDK, claves, endpoints ni fetch nuevos | PASS |
| IV. Tipos derivados del SDK | `TSessionMessage` viene de `Infrastructure/Services`; los tipos del dominio llevan prefijo `T` y no redefinen tipos del SDK | PASS |
| V. Lógica pura y testeable | `lib/analyzeSession.ts` y sus módulos son funciones puras sin React, sin estado, sin `Date.now()` ni aleatoriedad; se prueban con fixtures de mensajes reales | PASS |
| VI. Estados de pantalla obligatorios | El overlay resuelve error → carga → vacío → datos antes de montar los bloques; cada bloque declara su vacío. Un fallo de actualización con datos previos no oculta el informe: banner + datos marcados como no actualizados (FR-037) | PASS |
| VII. Rendimiento en tiempo real | No se toca el reducer, el batching ni el layout del grafo. El análisis se memoiza por identidades, se ejecuta solo con el panel abierto y no abre un reloj propio | PASS |
| VIII. Convenciones de repositorio | Specs en `specs/` junto al código, TS/ESLint strict, Conventional Commits, constantes en `thresholds.ts`/`labels.ts` (sin magic strings) y reutilización de primitivas existentes | PASS |

**Gate pre-Phase 0**: PASS — sin violaciones que justificar (`Complexity Tracking` vacío).
**Gate post-diseño**: PASS — ver [research.md](./research.md) R1–R12: no se introduce estado de
servidor, consulta, ruta, token ni dependencia nueva; los únicos cambios de contrato son **aditivos**
(`TFinding.condition`, `totals.windowTokens/latencyP95Ms/slowToolCalls` y la definición de
`TTurnAnalysis`) y están documentados en [contracts/efficiency-engine-contract.md](./contracts/efficiency-engine-contract.md).

## Project Structure

### Documentation (this feature)

```text
specs/015-session-efficiency-panel/
├── plan.md                                          # Este archivo (/speckit.plan)
├── spec.md                                          # Spec (no se modifica)
├── research.md                                      # Phase 0: R1–R12, 0 NEEDS CLARIFICATION
├── data-model.md                                    # Phase 1: entidades, invariantes, estados
├── quickstart.md                                    # Phase 1: validación ejecutable
├── contracts/
│   ├── efficiency-engine-contract.md                # Phase 1: contrato del motor puro
│   └── efficiency-overlay-contract.md               # Phase 1: contrato de UI/ARIA/integración
├── discovery/
│   ├── prd.md                                       # Insumo (no se modifica)
│   └── rfc.md                                       # Insumo (no se modifica)
├── checklists/requirements.md                       # Checklist vigente (no se modifica)
└── tasks.md                                         # Phase 2 (/speckit.tasks — NO lo crea este comando)
```

Documentos vigentes que **no** se tocan: `specs/014-inspector-detail-tabs/**` (7 pestañas),
`specs/004-inspector-panel-layout/contracts/**`, `specs/010-context-metrics-insights/contracts/**`,
`specs/013-fix-chat-history-freeze/**`.

### Source Code (repository root)

```text
src/Domains/Efficiency/
├── Efficiency.entity.ts                             # NUEVO: tipos del motor, turnos, factores
├── Hooks/
│   ├── useSessionEfficiency.ts                      # NUEVO: useQueries + memo + estado parcial
│   ├── index.ts                                     # NUEVO
│   └── specs/useSessionEfficiency.spec.tsx          # NUEVO: vacío/parcial/completo/actualización
├── Components/
│   ├── EfficiencyReport.tsx                         # NUEVO: orquesta estados y secciones
│   ├── EfficiencyVerdict.tsx                        # NUEVO: nota, banda, cobertura, confianza
│   ├── EfficiencyFactors.tsx                        # NUEVO: 2–3 factores de impacto
│   ├── EfficiencyFindings.tsx                       # NUEVO: hallazgos + señales débiles
│   ├── EfficiencyFindingCard.tsx                    # NUEVO: condición, cita, recomendación
│   ├── EfficiencyTurns.tsx                          # NUEVO: elige tabla (desktop) o tarjetas (móvil)
│   ├── EfficiencyTurnTable.tsx                      # NUEVO: tabla con caption/scope y expansión
│   ├── EfficiencyTurnCards.tsx                      # NUEVO: tarjetas móviles con expansión
│   ├── EfficiencyTurnDetail.tsx                     # NUEVO: prompt completo + evidencia (solo expandido)
│   ├── EfficiencyHowCalculated.tsx                  # NUEVO: pesos, mínimos, cobertura, confianza
│   ├── EfficiencyTotals.tsx                         # NUEVO: totales + coste/latencia como contexto
│   ├── EfficiencySkeleton.tsx                       # NUEVO: esqueleto del panel
│   ├── index.ts                                     # NUEVO
│   └── specs/                                       # NUEVO: verdes por componente
├── lib/
│   ├── analyzeSession.ts                            # NUEVO: orquestación pura
│   ├── turns.ts                                     # NUEVO: segmentación raíz → turnos
│   ├── rules.ts                                     # NUEVO: catálogo INP-1…RES-6
│   ├── score.ts                                     # NUEVO: indicadores, dimensiones, cobertura
│   ├── factors.ts                                   # NUEVO: 2–3 factores y puntos perdidos
│   ├── omissions.ts                                 # NUEVO: motivos de dimensión omitida
│   ├── text.ts                                      # NUEVO: tokenización, Jaccard, canónicos, recorte
│   ├── thresholds.ts                                # NUEVO: pesos, caps, mínimos, bandas
│   ├── labels.ts                                    # NUEVO: etiquetas y copy neutral
│   └── specs/                                       # NUEVO: tablas por regla y umbral
└── index.ts                                         # NUEVO: barrel del dominio

src/Infrastructure/
├── Components/
│   ├── EfficiencyOverlay.tsx                        # NUEVO: Radix Dialog + chrome + estados
│   ├── GraphPane.tsx                                # MOD: botón Eficiencia + prop onOpenEfficiency + isMobile
│   ├── WorkspaceView.tsx                            # MOD: slot efficiency
│   ├── WorkspaceLayout.tsx                          # MOD: render del slot en móvil y escritorio
│   └── specs/
│       ├── GraphPane.spec.tsx                       # MOD: botón, aria-haspopup, callback
│       ├── WorkspaceView.spec.tsx                   # MOD: slot
│       ├── WorkspaceLayout.spec.tsx                 # MOD: slot en ambas presentaciones
│       └── EfficiencyOverlay.spec.tsx               # NUEVO: diálogo, foco, Escape, estados
├── Hooks/
│   ├── useEfficiencyPanel.ts                        # NUEVO: open/close/isOpen/openedAt/foco
│   ├── useWorkspaceEscape.ts                        # MOD: no robar Escape con el diálogo abierto
│   └── specs/
│       ├── useEfficiencyPanel.spec.tsx              # NUEVO: reset por raíz, foco, reloj
│       └── useWorkspaceEscape.spec.tsx              # MOD: supresión con diálogo abierto
├── lib/
│   ├── buildEfficiencySessions.ts                   # NUEVO: grafo → mapa de sesiones del motor
│   └── specs/buildEfficiencySessions.spec.ts        # NUEVO
├── WorkspacePage.tsx                                # MOD: estado, mapa, exclusión mutua, slot
└── specs/
    ├── WorkspacePage.spec.tsx                       # MOD: cableado del overlay
    └── integration/workspaceEfficiencyOverlay.integration.spec.tsx # NUEVO: exclusión + Escape
```

**Structure Decision**: single project (SPA por dominios, estructura única del repo). La feature
sigue la convención vigente: **lógica pura** en `Domains/Efficiency/lib/` (Principio V),
**presentación** en `Domains/Efficiency/Components/` (Principio II), **datos** en el hook que
observa la caché de TanStack Query (Principio III), **composición cross-domain** en Infrastructure
(Principio II) y **specs** en carpetas `specs/` (Principio VIII). El Inspector no se toca: la
entrada vive en la cabecera del grafo y el overlay es un slot del workspace.

## Complexity Tracking

> Sin violaciones a la constitución. Tabla vacía a propósito.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

## Phase 0 — Outline & Research (salida)

Completa: [research.md](./research.md) — decisiones **R1–R12**, **0 `NEEDS CLARIFICATION`**.

- **R1 — Overlay y estado**: Radix Dialog full-screen montado como slot de Infrastructure; estado
  de vista en `useEfficiencyPanel` (`open/close/isOpen/openedAt/foco`), reset por cambio de raíz y
  exclusión mutua con `useHistory` en `WorkspacePage`. Sin 8.ª pestaña ni ruta.
- **R2 — Fuente y caché**: `TSessionMessage[]` de `sessions.messages(id)`; el hook es un **observador
  de caché** (`useQueries` con `queryFn: skipToken`, nunca habilitado), **sin fetch nuevo** ni clave
  nueva. La raíz no cacheada se muestra como carga mientras `rootReady` es falso y como `no_data`
  cuando ya está ready; el subárbol ausente se declara parcial. El error lo aporta el grafo
  (`graph.isError`) y un informe previo se conserva con banner.
- **R3 — Turnos**: pedido humano solo en la raíz; un turno se cierra con `idle` o con el siguiente
  `user` (interrupción); el turno abierto queda fuera de denominadores. Los pasos y herramientas de
  todo el subárbol se atribuyen por ventana temporal; la cancelación de un turno anterior no cierra
  al turno nuevo.
- **R4 — Texto**: normalización NFD, minúsculas, tokens `\p{L}\p{N}`, stopwords es/en, Jaccard sobre
  conjuntos; longitud y recorte en **code points**; canónico de herramienta acotado (profundidad 4,
  strings 256, total 1 000) y escritura de archivos solo por nombres declarados (`write`, `edit`,
  `patch`, `apply_patch`, `multiedit`).
- **R5 — Puntuación**: pesos 30/30/15/25; topes y mínimos de la spec; `1 − min(1, r/cap)` para
  fricción y `min(1, hit/0,6)` para caché; dimensión renormalizada sobre indicadores disponibles;
  global renormalizado sobre dimensiones disponibles; cobertura = peso disponible − 4,5 si la caché
  opcional se omite; entero al final; guardas en curso / <2 turnos / cobertura <60 %.
- **R6 — Hallazgos**: una emisión por regla (máximo 10), agregando conteo y usando la evidencia más
  representativa; sin ancla no se emite; orden determinista por penaliza → severidad → peso →
  turno → id; señales débiles aparte.
- **R7 — Confianza**: alta con cobertura ≥85 % y todas las dimensiones disponibles con el doble de
  su mínimo de muestra; media con cobertura ≥70 %; baja por debajo o con subárbol parcial; nunca
  alta por debajo de 85 %. Regla visible en "Cómo se calcula".
- **R8 — Totales y contraste**: totales derivados de los mensajes (solo pasos assistant; la
  compactación se muestra aparte); se reutiliza el `TSessionSummary` ya calculado por
  `summarizeSession`/`TNodeMetrics` como referencia, sin recalcularlo ni renderizar
  `SessionSummaryBar` dentro del panel. Se añaden `windowTokens`, `latencyP95Ms` y `slowToolCalls`
  a `totals` (aditivo).
- **R9 — Rendimiento**: una pasada, memo por identidades estables (patrón `useStableGraphModel`),
  sin tick de reloj, sin `JSON.stringify` repetido, sin re-layout del grafo; objetivo <1 s/200
  mensajes.
- **R10 — Integración y regresión**: botón en `GraphPane` antes de `Seguir`, `aria-haspopup`,
  icono con `aria-label` en móvil; slots en `WorkspaceView`/`WorkspaceLayout`; sin cambios en
  `queryKeys`, `buildHistory`, `summarizeSession`, `TGraphNodeData`, `sameNodeData` ni spec 014.
- **R11 — Accesibilidad y responsive**: Radix Dialog (focus trap, Escape, scroll-lock, retorno al
  disparador), `aria-label` "N de 100, banda", tabla con `caption`/`scope`, bandas y severidades
  con texto + icono, cifras ≥12 px, objetivos táctiles, 320 px sin scroll horizontal, movimiento
  reducido y contraste en los tres temas.
- **R12 — Subárbol parcial y cobertura**: la cobertura no se multiplica por sesiones cargadas
  (FR-010 la define como peso de dimensiones); el parcial se declara en `notes`, fuerza confianza
  baja y reduce cobertura **solo** cuando impide alcanzar el mínimo de una dimensión. No se
  inventan ceros.

## Phase 1 — Design & Contracts (salida)

- [data-model.md](./data-model.md): entidades del motor (`TEfficiencyInput`, `TEfficiencyReport`,
  dimensiones, indicadores, hallazgos, evidencia, turnos, factores), hechos internos, reglas de
  validación, precedencia de estados, ciclo de vida del turno y de la capa, y trazabilidad FR.
- [contracts/efficiency-engine-contract.md](./contracts/efficiency-engine-contract.md): contrato
  puro (entrada/salida, invariantes, tablas de pesos/topes/mínimos, composición, guardas,
  confianza, catálogo de hallazgos, orden, totales, determinismo y obligaciones de test).
- [contracts/efficiency-overlay-contract.md](./contracts/efficiency-overlay-contract.md): contrato
  de acceso, diálogo, foco, exclusión mutua, estados, layout, accesibilidad, privacidad, flujo de
  datos, superficie congelada y regresión.
- [quickstart.md](./quickstart.md): comandos y escenarios ejecutables (motor, hook, overlay,
  móvil, teclado, temas, rendimiento y cobertura).

**Gate post-diseño**: PASS (ver tabla de la Constitución y research R1–R12).

## Phase 2 — Tasks

Fuera de este comando (`/speckit.tasks`). Reparto esperado por historia:

- **US1 (veredicto)**: `score.ts`, `factors.ts`, `EfficiencyVerdict`, `EfficiencyFactors`,
  `EfficiencyHowCalculated`, `EfficiencyTotals`.
- **US2 (hallazgos)**: `rules.ts`, `EfficiencyFindings`, `EfficiencyFindingCard`.
- **US3 (turnos)**: `turns.ts`, `EfficiencyTurns`, `EfficiencyTurnTable`, `EfficiencyTurnCards`,
  `EfficiencyTurnDetail`.
- **US4 (guardas y estados)**: guards en `analyzeSession.ts`, `EfficiencyReport`,
  `EfficiencyOverlay`, estados de error/carga/vacío/parcial.
- **US5 (móvil)**: `EfficiencyTurnCards`, layout de 320 px, `useDevice`/prop de presentación.
- **Cableado y regresión**: `useEfficiencyPanel`, `useSessionEfficiency`,
  `buildEfficiencySessions`, `GraphPane`, `WorkspaceView`, `WorkspaceLayout`, `WorkspacePage`,
  `useWorkspaceEscape` y todos los specs.
