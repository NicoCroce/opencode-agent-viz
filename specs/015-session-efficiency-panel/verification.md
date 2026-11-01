# Verificación — `015-session-efficiency-panel`

**Feature**: `015-session-efficiency-panel` | **Fecha**: 2026-10-23 | **Unidad**: U40 (T067, T068)
**Plan**: [plan.md](./plan.md) | **Guía**: [quickstart.md](./quickstart.md) | **Línea base**: [baseline.md](./baseline.md)

Cierre de la feature: compuertas completas, cobertura, rendimiento, auditoría de la superficie
congelada y revisión de accesibilidad/deuda. Todo contra la línea base firmada en `baseline.md`
(commit `d6bba8ce1982829300afd1aae36ba3ae50958771`).

- **Commit del árbol verificado**: `d6bba8ce1982829300afd1aae36ba3ae50958771` (`git rev-parse HEAD`;
  los cambios de la feature están **sin commitear** en el working tree).
- **Entorno**: macOS (darwin), Node v22.12.0, pnpm 9.7.1; `vitest run` (pool `threads`, 4 workers).
- **Estado de partida**: T001–T066 marcadas; motor, hook, componentes, overlay, cableado y los 10
  E2E ya en el árbol.
- Todos los comandos se ejecutan desde la raíz del repo.

---

## T067 · Compuertas, cobertura y auditoría

### Pruebas del alcance

| comando | alcance | ficheros | tests | duración | estado |
|---|---|---|---|---|---|
| `pnpm test -- src/Domains/Efficiency` | motor + hook + componentes | 21 | 225 | 5.03 s | **verde** (225 passed, 0 fallos) |
| `pnpm test -- src/Infrastructure` | todos los specs de Infrastructure (incluye los 10 E2E) | 67 | 470 | 16.76 s | **verde** (470 passed, 0 fallos) |
| los diez E2E (lista de abajo) | fronteras U1↔U2 … U5↔U7 | 10 | 45 | 5.51 s | **verde** (45 passed, 0 fallos) |
| `pnpm test:coverage` | suite completa + cobertura v8 | 253 | 2498 (2497 passed, 1 skipped) | 51.94 s | **verde** (0 fallos) |

Detalle de los diez E2E de `src/Infrastructure/specs/integration/`:

| fichero | tests | duración |
|---|---|---|
| `efficiencyCacheToReport.integration.spec.tsx` | 3 | 193 ms |
| `efficiencyFindingsEvidence.integration.spec.tsx` | 6 | 463 ms |
| `efficiencyGraphProjection.integration.spec.tsx` | 5 | 1051 ms |
| `efficiencyOverlayStates.integration.spec.tsx` | 9 | 1991 ms |
| `efficiencyPanelAccessFocus.integration.spec.tsx` | 4 | 972 ms |
| `efficiencyReportToVerdict.integration.spec.tsx` | 3 | 308 ms |
| `efficiencyResponsiveParity.integration.spec.tsx` | 2 | 339 ms |
| `efficiencyTotalsAvailability.integration.spec.tsx` | 3 | 715 ms |
| `efficiencyTurnsLifecycle.integration.spec.tsx` | 5 | 308 ms |
| `workspaceEfficiencyOverlay.integration.spec.tsx` | 5 | 667 ms |

Specs de cableado (modificados, incluidos en la pasada de Infrastructure): `GraphPane` 19 tests,
`WorkspaceView` 13, `WorkspaceLayout` 10, `WorkspacePage` 30, `useWorkspaceEscape` 12,
`EfficiencyOverlay` 13, `useEfficiencyPanel` 6, `buildEfficiencySessions` 6.

### Compuertas estáticas

| compuerta | comando | resultado | estado |
|---|---|---|---|
| TypeScript (app) | `pnpm tsc` | exit `0`, sin diagnósticos | verde |
| TypeScript (config Node) | `pnpm tsc:node` | exit `0`, sin diagnósticos | verde |
| ESLint | `pnpm lint` | exit `0`, 0 errores / 0 warnings (solo el aviso preexistente `React version not specified`) | verde |

### Cobertura (`pnpm test:coverage`, exit `0`)

| ámbito | líneas | ramas | funciones | statements | umbral | veredicto |
|---|---|---|---|---|---|---|
| `src/Domains/Efficiency/lib/**` | **98.62 %** | **91.30 %** | 99.00 % | 98.62 % | ≥90 / ≥85 | **cumple** |
| `src/Domains/Efficiency/Hooks/**` | **100 %** | **97.91 %** | 100 % | 100 % | ≥80 | **cumple** |
| `src/Domains/Efficiency/Components/**` | **99.69 %** | **93.71 %** | 100 % | 99.69 % | ≥80 | **cumple** |
| Total del repo | 99.19 % | 95.49 % | 94.63 % | 99.19 % | — | verde |

- Ficheros del dominio por debajo del 100 % de ramas pero dentro del umbral: `omissions.ts` 84.21,
  `factors.ts` 86.20, `rules.ts` 86.70, `EfficiencyTurnDetail.tsx` **80.00** (límite exacto),
  `EfficiencyVerdict.tsx` 87.50.
- `Efficiency.entity.ts` figura al 0 %: solo contiene tipos/constantes de tipo y no computa para los
  umbrales pedidos (lib, hook y secciones).

### Rendimiento y ausencia de red

- **200 mensajes < 1 000 ms**: `analyzeSession.spec.ts` › «analiza 200 mensajes en menos de 1 s»
  ejecuta `buildLongSession(200)` y mide con `performance.now()`; la aserción
  `elapsedMs < 1_000` pasa. El fichero completo (16 tests) corre en **19–22 ms**, muy por debajo del
  presupuesto. `pnpm test -- src/Domains/Efficiency/lib/specs/analyzeSession.spec.ts` → 16 passed.
- **0 peticiones de red al abrir**: el hook se suscribe con `queryFn: skipToken` y
  `efficiencyCacheToReport.integration.spec.tsx` sustituye `fetch` por un espía: tras abrir y tras
  `setQueryData` se cumple `fetchSpy` no llamado y `fetchStatus === 'idle'` en todas las queries.
  E2E verde.

### Auditoría del DOM

| comprobación | método | resultado |
|---|---|---|
| 0 comparaciones / rankings / percentiles | `rg -niE "percentil\|ranking\|comparaci[oó]n\|mejor que\|peor que\|benchmark"` sobre dominio y overlay | **0 en DOM**. Solo aparecen comentarios internos (P95 nearest-rank en `turns.ts`, comparación lexicográfica en `rules.ts`), la etiqueta de banda «mejorable» y «media desde» (mediana de dimensiones, no comparación entre sesiones). `latencyP95Ms` es un total crudo de contexto (R8), no una nota ni un ranking |
| 0 puntuación de longitud / idioma / gramática / tono / cortesía | `rg -niE "gram[aá]tica\|tono de\|cortes[ií]a\|idioma\|language\|politeness\|courtesy"` sobre `src/Domains/Efficiency` | **0 coincidencias**. El motor no puntúa esas dimensiones |
| 0 hallazgos sin ancla / cita | guarda `makeFinding` (`rules.ts`): `messageId` vacío ⇒ no se emite; toda cita pasa por `buildQuote` | **0**. Specs: `rules.spec` «no emite sin ancla (messageId vacío)» y `analyzeSession.spec` «omite un candidato sin ancla», verdes |
| 0 datos ausentes mostrados como 0/100 | `UnavailableValue` («no disponible») en totales y turnos | **0**. `EfficiencyTotals.spec` verifica 7 etiquetas «no disponible» y nunca 0/100; tablas y tarjetas usan «no disponible»/«—» |

### Superficie congelada y dependencias

```text
$ git diff --exit-code -- src/Domains/queryKeys.ts \
    src/Domains/History/lib/buildHistory.ts \
    src/Domains/Graph/lib/metrics/summarizeSession.ts \
    src/Domains/Graph/Graph.entity.ts specs/014-inspector-detail-tabs/
# sin salida
$ echo $?
0
```

```text
$ git diff --exit-code -- package.json pnpm-lock.yaml
# sin salida
$ echo $?
0
```

- `git status --short` sobre `queryKeys.ts`, `Routes.tsx`, `*.routes.ts` y `*.router.tsx`: **sin
  cambios**. No hay ruta, clave de query ni `data-testid` público nuevos.
- **0 dependencias nuevas** (`package.json` y `pnpm-lock.yaml` sin diff); `@radix-ui/react-dialog`
  ya estaba instalado.
- Los ficheros nuevos de la feature aparecen como *untracked*; nada se ha añadido al índice.

---

## T068 · Revisión manual, deuda y compuerta de constitución

### Revisión de accesibilidad y deuda

| criterio | evidencia en jsdom / código | estado |
|---|---|---|
| Teclado completo: abrir, recorrer, expandir, cerrar, volver al disparador | `EfficiencyOverlay.spec` (13 tests): diálogo con nombre, Tab/Shift+Tab ciclan, `Escape` cierra, «Cerrar» cierra y `onCloseAutoFocus` restaura el foco; `efficiencyPanelAccessFocus` (4 tests) cubre apertura, cierre por cambio de raíz y disparador desmontado; `EfficiencyTurnTable.spec` expande/colapsa con `aria-expanded`/`aria-controls` | **verde** (jsdom); recorrido real en navegador, deuda |
| 320 px sin scroll horizontal | `efficiencyResponsiveParity` comprueba `min-w-0`, `break-words`, `flex-wrap` y ausencia de anchos fijos en tarjetas, títulos y prompt; en móvil usa tarjetas, no tabla ancha | **estructural verde**; medición visual a 320 px, **deuda** |
| Temas claro / oscuro / `forced-colors` | Sin colores literales ni `text-[…]`/`bg-[…]`; solo tokens semánticos (`text-foreground`, `text-muted-foreground`, `bg-surface-1`, `border-border`, `text-status-*`, `bg-muted/30`). Banda y severidad usan **texto + icono** (`BAND_ICON`, `SEVERITY_ICON` decorativos) | **guardias verdes**; `forced-colors` real, **deuda** |
| Contraste 4.5:1 / 3:1 | Sin valores hardcodeados; los tokens son los del tema compartido | **no medible en jsdom**; verificación visual, **deuda** |
| `prefers-reduced-motion` | Sin count-up, sin `transition-*`/`duration-*` en el panel; única animación, `animate-pulse` del `Skeleton` de carga (decorativa) | **sin movimiento imprescindible**; comprobación visual, deuda menor |
| Objetivos táctiles | Botones con el `Button` compartido (`h-control` = 2.6 rem ≈ 41.6 px); el expansor de cita/turno es un enlace inline (`h-auto! p-0! text-xs`) | **deuda**: medir el expansor en dispositivo táctil |
| `dangerouslySetInnerHTML` | `rg dangerouslySetInnerHTML` sobre dominio y overlay | **0 coincidencias** |

### Compuerta de constitución (I–VIII)

| principio | veredicto | evidencia |
|---|---|---|
| I. Observador con modo interactivo | **PASS** | El panel solo lee caché; no envía prompts ni muta estado del servidor |
| II. Arquitectura por dominios | **PASS** | `src/Domains/Efficiency/{Components,Hooks,lib,entity,index}`; overlay y cableado en `Infrastructure` |
| III. Datos solo vía TanStack Query | **PASS** | Hook observa `queryKeys.sessions.messages` con `skipToken`; 0 fetch; SDK solo en services existentes |
| IV. Tipos derivados del SDK | **PASS** | Entidades `T*` derivadas de `@opencode/client`; sin redefiniciones manuales |
| V. Lógica pura y testeable | **PASS** | `lib/**` puro, determinista, 98.62 % líneas / 91.30 % ramas |
| VI. Estados de pantalla obligatorios | **PASS** | Carga (skeleton), error (`EmptyScreenError`), vacío (`Sin mensajes`), datos; header y «Cerrar» siempre presentes |
| VII. Rendimiento en tiempo real | **PASS** | Sin cambios en reducer, batching, layout ni `sameNodeData`; memo por identidades, sin reloj; 200 mensajes < 1 s |
| VIII. Convenciones de repositorio | **PASS** | Specs en carpetas `specs/`; `tsc`, `tsc:node` y `lint` en exit 0; 0 fallos en la suite |

**Veredicto global de la compuerta**: **PASS** con las deudas visuales declaradas (medición real a
320 px, `forced-colors`, ratios de contraste y objetivo táctil del expansor), no ejecutables en este
entorno sin navegador.

### Firma

- `git rev-parse HEAD` final: `d6bba8ce1982829300afd1aae36ba3ae50958771` (sin commits nuevos).
- Suite: **253 ficheros / 2498 tests (2497 passed, 1 skipped) / 0 fallos / 51.94 s**.
- Cobertura: `lib` 98.62 % líneas / 91.30 % ramas; hook 100 / 97.91; componentes 99.69 / 93.71.
- Superficie congelada: `git diff --exit-code` en **exit 0**, sin salida.
- Dependencias, claves y rutas nuevas: **0**.
