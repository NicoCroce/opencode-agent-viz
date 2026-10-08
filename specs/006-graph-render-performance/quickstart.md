# Quickstart — Rendimiento del visualizador de grafo

**Feature**: `006-graph-render-performance`
**Objetivo**: validar de extremo a extremo que el cambio de sesión y la interacción del grafo
mejoran sin cambiar nada de lo visible, capturando una **línea base** antes de los cambios y
comparándola después.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) ·
[contracts/](./contracts/).

---

## Prerrequisitos

- Node.js y dependencias instaladas: `npm install`.
- Para la validación manual en navegador: una instancia de OpenCode server accesible vía el
  proxy de Vite (`OPENCODE_URL`).
- Una **muestra de sesiones representativa**:
  - al menos una sesión **pequeña** (≤ 5 agentes);
  - al menos una sesión **grande** (~50 agentes) con contenido abundante por agente;
  - si es posible, una sesión **muy grande** (≥ 100 agentes) para SC-004;
  - una sesión **en curso** (con agentes activos) para SC-005 y FR-009.
- Navegador con DevTools (Perfil de rendimiento) para leer las medidas
  `graph.session.*`/`graph.interaction` (ver [contracts/performance-instrumentation-contract.md](./contracts/performance-instrumentation-contract.md)).

---

## 1. Validación automatizada (obligatoria)

```bash
# Núcleo del dominio Graph (libs puras + hooks + componentes)
npx vitest run src/Domains/Graph

# Instrumentación
npx vitest run src/Application/Helpers

# Suite completa + tipos + lint (puerta de calidad del repo)
npm test
npm run tsc
npm run lint
```

**Esperado**: verde. Los specs nuevos cubren las funciones puras y los hooks de esta feature:

- `loadPriority.spec.ts` — orden de prioridad, `skippedIds`, chunks (L1..L3).
- `reconcileGraph.spec.ts` — reutilización de nodos por identidad y estabilidad de `edges` (C1..C2).
- `deriveMetrics.spec.ts` (extendido) — `deriveMetricBase` sin `now` + `resolveMetrics` (R3).
- `buildGraph.spec.ts` (extendido) — `enrichment` y **paridad** campo a campo sobre fixtures (C6).
- `useGraphStructure.spec.tsx` — estructura sin consultas de contenido (L4).
- `useGraphEnrichment.spec.tsx` — lotes, `pending→ready`, cancelación por cambio de sesión (L5..L6).
- `useGraphEnrichment.freshness.spec.tsx` — el enriquecimiento escribe en las mismas claves que `eventReducer` (frescura ≤ 1 s, FR-009/L9).
- `useGraphModel.spec.tsx` — API pública sin cambios y revisita sin recarga (L7..L8).
- `WorkspacePage.perf.spec.tsx` / `WorkspacePage.spec.tsx` (extendidos) — open vs revisit (P4) y tick del resumen condicionado a nodos activos (FR-006, FR-024 de 003-execution-detail-views).
- `AgentGraph.spec.tsx` / `AgentNode.spec.tsx` (extendidos) — foco por contexto y no-rebuild (C3..C4).
- `buildViewNodes.spec.ts` (extendido) — `cardHeight` una sola vez (C5).
- `perf.spec.ts` — nombres/`detail` y no-op sin `performance` (P1..P3).

Opcional, si hay server real disponible:

```bash
npm run test:live   # integración contra el server Vía VIZ_API_URL + OPENCODE_PASSWORD
```

---

## 2. Captura de línea base (antes de los cambios)

Con la implementación **actual** (sin los cambios de esta feature):

1. Abrir la app (`npm run dev` o `npm start`) y arrancar el perfil de rendimiento.
2. **Apertura (fría)**: con el caché frío, seleccionar la sesión **grande** y anotar el tiempo
   hasta que el grafo está encuadrado. Repetir 5 veces (o usar las marcas `graph.session.open`).
3. **Apertura (pequeña)**: igual con la sesión **pequeña** (para SC-002).
4. **Revisita**: volver a la sesión pequeña, luego a la grande, y anotar `graph.session.revisit`.
5. **Interacción**: en la sesión de ≥ 100 agentes, ejecutar una secuencia de pan, zoom, hover y
   selección y anotar las pausas / `graph.interaction`.
6. Guardar los números (p50/p90) como **línea base**; se adjuntan al PR.

> Los objetivos se miden en el equipo de referencia con caché fría salvo donde diga "ya visitada"
> (Assumptions de la spec).

---

## 3. Validación manual (después de los cambios)

### US1 — Cambiar de sesión sin esperas largas (FR-001..FR-004, SC-001..SC-003, SC-007, SC-008)

1. Seleccionar la sesión **grande** nunca visitada.
   - **Esperado**: la selección/cabecera responden al instante; la estructura del grafo aparece
     primero y las métricas se completan después; la UI sigue respondiendo durante la carga
     (US1 esc. 2, FR-001, FR-010, SC-007).
2. Comparar el tiempo de apertura encuadrada contra los ≤ 1.5 s p90 (SC-001) y contra la línea base.
3. Comparar apertura grande vs pequeña: ≤ 2× (SC-002).
4. Volver a una sesión ya visitada.
   - **Esperado**: el grafo aparece de forma percibida como inmediata, sin recargar (US1 esc. 1,
     FR-004, SC-003: ≤ 300 ms p90).
5. Cambiar de sesión varias veces rápido entre sesiones grandes.
   - **Esperado**: la sesión finalmente elegida no se degrada por el trabajo abandonado (edge case).
6. Con una sesión grande cargando, interactuar con la lista y la cabecera.
   - **Esperado**: respuesta inmediata, estado de carga claro (US1 esc. 3).

### US2 — Fluidez con muchos nodos (FR-005, SC-004)

1. En la sesión de 100 a ~200 agentes, hacer pan y zoom.
   - **Esperado**: sin pausas perceptibles, < 100 ms por interacción (US2 esc. 1).
2. Pasar el cursor por un nodo.
   - **Esperado**: se resaltan sus relaciones directas sin pausa perceptible (US2 esc. 2).
3. Seleccionar un nodo.
   - **Esperado**: se resalta el linaje y se atenúa el resto, fluido (US2 esc. 3).

> Verificación interna: hover y selección **no** deben recrear los arrays de nodos/aristas
> ([graph-render-contract.md](./contracts/graph-render-contract.md) §1.2).

### US3 — Actualizaciones en vivo (FR-006, FR-009, SC-005)

1. Con la sesión **en curso** y grafo grande, observar varios ciclos de actualización de tiempo.
   - **Esperado**: los tiempos avanzan sin reacomodo ni parpadeo; la fluidez no se degrada (US3 esc. 2, FR-006).
2. Verificar que una actualización que afecta a **1 de 100** agentes no reacomoda el grafo (SC-005).
3. Generar ráfagas de eventos (una ejecución activa intensa).
   - **Esperado**: se agrupan y la UI no se bloquea (US3 esc. 3).
4. Medir el desfase de los datos en vivo.
   - **Esperado**: ≤ 1 s respecto del server, igual que hoy (FR-009).

### US4 — Paridad sin regresiones (FR-007, FR-008, SC-006)

1. Comparar, por sesión de la muestra, nodos, aristas, carriles, estados, métricas, linaje,
   selección, hover, redimensionado e histórico contra la **línea base**.
   - **Esperado**: **100 %** de coincidencia (SC-006).
2. Seleccionar un nodo, revisar el linaje y abrir el histórico.
   - **Esperado**: comportamiento idéntico (US4 esc. 2).
3. Con un resize de nodos aplicado, cambiar de sesión y volver.
   - **Esperado**: el reseteo de tamaños se comporta como hoy (US4 esc. 3).
4. Estados de pantalla: forzar error de red, vacío (sesión sin agentes) y carga.
   - **Esperado**: error→carga→vacío→datos sin cambios (FR-008, Principio VI).

### Edge cases

- **Sesión sin agentes**: `EmptyState` actual, sin coste de render de grafo.
- **Subárbol muy grande nunca visitado**: la UI no se congela, muestra progreso y permite cambiar de sesión.
- **Sesión activa que emite eventos mientras carga**: los eventos se integran sin rehacer la carga hecha.
- **Cambio rápido y repetido de sesión**: sin degradación de la elegida.
- **Fallo de red al cargar**: se conserva el estado de error, sin bloquear la vista.
- **Sesión en otro proyecto/directorio**: sin recargas innecesarias ya resueltas.
- **Redimensionado extremo**: un nodo muy grande no multiplica el coste de la vista.

---

## 4. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| FR-001 | Respuesta inmediata de selección y cabecera al cambiar de sesión (US1 esc. 1-3); la estructura progresiva es FR-010. |
| FR-002 / SC-001, SC-002 | Apertura grande ≤ 1.5 s p90 y ≤ 2× la pequeña. |
| FR-003 | Coste no lineal con el contenido; carga por lotes priorizados (L1..L3). |
| FR-004 / SC-003 | Revisita ≤ 300 ms sin recarga (L7). |
| FR-005 / SC-004 | Interacción < 100 ms de 100 a ~200 nodos; identidad estable (C1..C4). |
| FR-006 / SC-005 | Tick O(nodos) y refresco local; 1/100 no reacomoda (R3). |
| FR-007 / SC-006 | Paridad campo a campo sobre fixtures (C6). |
| FR-008 | Estados de pantalla preservados (WorkspacePage sin cambios de orden). |
| FR-009 | Desfase en vivo ≤ 1 s (mismas claves que `eventReducer`). |
| FR-010 | Estructura primero, métricas después (L4..L5). |
| FR-011 / SC-001..SC-004 | Marcas `graph.session.*`/`graph.interaction` (P1..P5). |
| SC-007 | UI responsiva durante la carga por lotes (L5). |
| SC-008 | Sin trabajo repetido ni contenido no mostrado (L2, L7). |

---

## 5. Salida esperada

- Specs verdes, `tsc`/`lint` sin errores.
- Tabla antes/después de SC-001..SC-004 con la muestra y el equipo de referencia.
- Confirmación de paridad (SC-006) sobre la muestra.
