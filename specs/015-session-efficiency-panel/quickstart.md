# Quickstart — Panel de eficiencia de sesión

**Feature**: `015-session-efficiency-panel` | **Fecha**: 2026-10-23
**Plan**: [plan.md](./plan.md) · **Modelo**: [data-model.md](./data-model.md)
**Contratos**: [engine](./contracts/efficiency-engine-contract.md) ·
[overlay](./contracts/efficiency-overlay-contract.md)

Guía de validación ejecutable. No contiene la implementación ni el código de los tests; fija los
comandos y los resultados esperados.

## 1. Prerrequisitos

- Node y pnpm instalados (el repo usa pnpm).
- Dependencias instaladas:
  ```bash
  pnpm install
  ```
- Navegador moderno con soporte de `forced-colors` (Chrome/Edge) para la revisión visual final.
- No hace falta un servidor de OpenCode para los tests: los specs usan fixtures y caché sembrada.
  Para la revisión manual del overlay sí hace falta el dev server y una sesión real o el harness de
  fixtures del repo.

## 2. Comandos base

```bash
pnpm test -- src/Domains/Efficiency          # motor + hook + componentes
pnpm test -- src/Infrastructure/Components/specs/GraphPane.spec.tsx
pnpm test -- src/Infrastructure/Components/specs/WorkspaceView.spec.tsx
pnpm test -- src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx
pnpm test -- src/Infrastructure/Components/specs/EfficiencyOverlay.spec.tsx
pnpm test -- src/Infrastructure/specs/integration/workspaceEfficiencyOverlay.integration.spec.tsx
pnpm tsc
pnpm tsc:node
pnpm lint
pnpm test:coverage
```

`pnpm test` usa el pool `threads` con 4 workers; `pnpm test:coverage` genera `lcov`/HTML.

## 3. Escenario A — Motor puro (node)

**Objetivo**: demostrar segmentación, reglas, score y guardas sin DOM.

1. Ejecutar:
   ```bash
   pnpm test -- src/Domains/Efficiency/lib
   ```
2. Comprobar en la salida:
   - `turns.spec.ts`: turno normal, interrumpido, idle de cancelación, abierto y subagente
     atribuido por tiempo.
   - `text.spec.ts`: acentos, stopwords, Jaccard 0,59/0,60/0,61, token count 5/6/7, code points,
     canónico y ruta.
   - `rules.spec.ts`: tabla positivo/negativo/umbral±1 por regla, sin ancla → no emite, señales
     débiles, cap 10.
   - `score.spec.ts`: dimensiones disponibles/omitidas, caché omitida, outcome 1/0,5/0, cobertura
     59/60, bandas 49/50, 69/70, 84/85, confianza alta/media/baja/parcial.
   - `analyzeSession.spec.ts`: sesión limpia, con fricción, en curso, <2 turnos, sin datos, parcial;
     dos ejecuciones con el mismo input devuelven el mismo informe; totales coincidentes con
     `summarizeSession` en una sesión de un nodo.
3. Resultado esperado: **0 fallos**, **0 `NEEDS CLARIFICATION`**, ningún test de DOM en `node`.

**Criterios**: FR-021/FR-022 (determinismo, sin LLM), FR-008…FR-019, SC-004/SC-007/SC-008.

## 4. Escenario B — Hook de datos (jsdom)

**Objetivo**: caché, raíz, subárbol parcial, error y actualización.

1. Ejecutar:
   ```bash
   pnpm test -- src/Domains/Efficiency/Hooks
   ```
2. Comprobar:
   - `enabled: false` → no hay observación ni informe.
   - Raíz en caché → informe; raíz ausente con `rootReady: false` → carga; raíz ausente con
     `rootReady: true` → `no_data`; `graphError: true` sin datos → `isError`.
   - Raíz + hijo en caché → informe; falta el hijo → `isPartial` y `missingSessionIds`.
   - `queryClient.setQueryData(sessions.messages(child), …)` → nuevo informe; volver a renderizar
     con las mismas referencias → la referencia del informe no cambia.
   - Sesión activa (`status: 'active'`) → `in_progress` y `score: null`.
   - Sin mensajes y raíz `ready` → `no_data`.
3. Resultado esperado: **0 fallos**; **ninguna petición de red** (el hook solo lee la caché).

**Criterios**: FR-004, FR-013, FR-018, FR-036/FR-037, R2/R9.

## 5. Escenario C — Overlay y componentes (jsdom)

**Objetivo**: diálogo, foco, estados y contenido.

1. Ejecutar:
   ```bash
   pnpm test -- src/Domains/Efficiency/Components
   pnpm test -- src/Infrastructure/Components/specs/EfficiencyOverlay.spec.tsx
   ```
2. Comprobar:
   - `role="dialog"` con nombre “Eficiencia de la sesión”.
   - Foco atrapado: `Tab` cicla dentro; `Escape` cierra; el foco vuelve al botón que abrió.
   - “Cerrar” cierra; el header sigue visible en carga/error/vacío.
   - Estados: carga (skeleton), error (`EmptyScreenError`), vacío (`Sin mensajes`), en curso
     (banner “Sesión en curso: sin nota”), insuficiente (banner con motivo), datos (veredicto).
   - Veredicto: nota, banda, cobertura, confianza, `aria-label` “N de 100, banda”, 2–3 factores con
     conteo y signo.
   - Hallazgos: condición, cita, recomendación, severidad; cita recortada a 120 code points y
     completa solo al expandir; señales débiles separadas; “Ver N más”.
   - Turnos: tabla con `caption`/`scope`, orden, expansión, prompt corto sin botón, turno abierto
     marcado; tarjetas móviles con los mismos datos.
   - “Cómo se calcula”: pesos, mínimos, omisiones, cobertura, confianza, bandas, notas y “coste y
     latencia no puntúan”.
   - Totales: “no disponible” en ausencia, no 0; contraste con la cabecera.
3. Resultado esperado: **0 fallos**.

**Criterios**: FR-005/FR-008/FR-015/FR-023…FR-030/FR-036…FR-046, SC-004/SC-009.

## 6. Escenario D — Integración con el workspace

**Objetivo**: entrada desde la cabecera, exclusión mutua y `Escape`.

1. Ejecutar:
   ```bash
   pnpm test -- src/Infrastructure/Components/specs/GraphPane.spec.tsx
   pnpm test -- src/Infrastructure/Components/specs/WorkspaceView.spec.tsx
   pnpm test -- src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx
   pnpm test -- src/Infrastructure/specs/integration/workspaceEfficiencyOverlay.integration.spec.tsx
   ```
2. Comprobar:
   - `GraphPane` con al menos un nodo pinta `Eficiencia` antes de `Seguir`, con
     `aria-haspopup="dialog"`; el callback recibe el botón como disparador. Sin nodos, no se monta.
   - En móvil (`isMobile`), el botón es icono con `aria-label` y no muestra texto.
   - `WorkspaceView`/`WorkspaceLayout` montan el slot `efficiency` en móvil y escritorio.
   - Abrir eficiencia con el histórico abierto lo cierra; abrir el histórico cierra eficiencia.
   - `Escape` con el diálogo abierto no limpia la selección del grafo.
   - Cambiar de sesión raíz cierra el panel.
3. Resultado esperado: **0 fallos**.

**Criterios**: FR-001/FR-006/FR-038/FR-039, R1/R10.

## 7. Escenario E — Revisión manual en navegador

Con `pnpm dev` y una sesión con al menos 2 turnos cerrados:

1. Abrir la sesión en el grafo y pulsar **Eficiencia** en la cabecera.
2. Verificar:
   - El overlay cubre la pantalla, bloquea el scroll de fondo y muestra el veredicto.
   - La nota, la banda, la cobertura y la confianza son legibles; los factores muestran conteo y
     signo.
   - Los hallazgos tienen cita con turno/mensaje y recomendación; las señales débiles están aparte.
   - La tabla de turnos se expande; el prompt completo solo aparece al expandir.
   - “Cómo se calcula” abre y explica pesos, omisiones y confianza.
   - Coste y latencia aparecen como contexto y no cambian la nota.
3. Cerrar con **Cerrar** y con `Escape`; el foco vuelve al botón **Eficiencia**.
4. Abrir el histórico y comprobar que eficiencia se cierra; al revés, idem.
5. Abrir una sesión en curso, una de un solo turno y una sin mensajes:
   - En curso: “Sesión en curso”, sin nota, métricas crudas.
   - Un turno: “Muestra insuficiente”, sin nota.
   - Sin mensajes: “Sin mensajes”, sin nota.
6. Reducir el viewport a **320 px**:
   - Sin scroll horizontal de página.
   - Los turnos son tarjetas; la expansión muestra el prompt completo.
   - El veredicto y los hallazgos siguen legibles; las cifras ≥12 px.
7. Probar tema claro, oscuro y `forced-colors`:
   - Banda y severidad se distinguen por texto + icono.
   - El foco es visible; no hay dependencia solo del color.
8. Activar `prefers-reduced-motion`: no hay animaciones imprescindibles ni count-up.

**Criterios**: FR-001/FR-005/FR-030/FR-034/FR-038…FR-044, SC-009/SC-010.

> La revisión visual de 320 px, `forced-colors` y contraste es deuda explícita de jsdom; se anota
> en la verificación de la feature.

## 8. Escenario F — Rendimiento

1. Usar el fixture de 200 mensajes de `lib/specs/fixtures.ts` (o generarlo con el builder).
2. Ejecutar el test de rendimiento de `analyzeSession.spec.ts`:
   ```bash
   pnpm test -- src/Domains/Efficiency/lib/specs/analyzeSession.spec.ts
   ```
3. Resultado esperado: `performance.now()` alrededor de `analyzeSession` **< 1 000 ms** (el motor
   real debe quedar muy por debajo). No hay fetch al abrir con la caché sembrada.
4. En navegador, abrir una sesión de 200 mensajes y comprobar que el panel aparece con datos en
   menos de 1 s y que el grafo no se re-layouta (SC-006).

## 9. Escenario G — Cobertura y calidad

```bash
pnpm test:coverage
pnpm tsc
pnpm tsc:node
pnpm lint
```

Esperado:

- `src/Domains/Efficiency/lib/**`: ≥90 % líneas y ≥85 % ramas.
- Hook y componentes del dominio: ≥80 %.
- `tsc`/`tsc:node`/`lint` sin errores.
- `git diff` sin cambios en `src/Domains/queryKeys.ts`, `buildHistory`, `summarizeSession`,
  `TGraphNodeData`, `sameNodeData`, `InspectorSectionTabs` ni en las 7 pestañas de la spec 014.

## 10. Mapa de aceptación

| Escenario | US | SC |
|---|---|---|
| A (motor) | US1/US2/US4 | SC-004, SC-007, SC-008, SC-011 |
| B (hook) | US1/US4 | SC-003, SC-006 |
| C (overlay/componentes) | US1/US2/US4 | SC-004, SC-007, SC-009 |
| D (integración) | US1/US4 | SC-009 |
| E (manual) | US1…US5 | SC-001, SC-009, SC-010 |
| F (rendimiento) | US1 | SC-006 |
| G (calidad) | todas | SC-002, SC-008 |

## 11. Problemas frecuentes

- **El panel no abre**: comprobar que `GraphPane` recibe `onOpenEfficiency` y que
  `useEfficiencyPanel` no está cerrado por cambio de raíz.
- **“Sin datos” con sesión real**: verificar que la raíz está en caché
  (`sessions.messages(rootId)`) y que `rootReady` es `true`; si no, el enriquecimiento del grafo
  aún no terminó.
- **Subárbol parcial**: es esperado si el grafo aún no cargó todos los nodos; el banner y la
  confianza baja lo declaran. El panel no dispara ningún fetch.
- **Sin nota**: revisar la guarda (`in_progress`, `<2` turnos cerrados o cobertura `<60`); el
  banner y “Cómo se calcula” indican el motivo.
- **Foco no vuelve**: comprobar que `open(trigger)` recibió `event.currentTarget` y que el
  `onCloseAutoFocus` del diálogo llama a `restoreFocus`.
- **Doble capa**: revisar la exclusión mutua en `WorkspacePage` (eficiencia ↔ histórico).
