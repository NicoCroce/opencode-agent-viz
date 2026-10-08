# Contrato — Instrumentación de rendimiento

**Feature**: `006-graph-render-performance`
**Cubre**: FR-011 · SC-001, SC-002, SC-003, SC-004
**Implementa**: `Application/Helpers/perf.ts`, `Infrastructure/WorkspacePage.tsx`,
`Domains/Graph/Components/AgentGraph.tsx`, `Domains/Graph/Hooks/useGraphModel.ts`.

---

## 1. Objetivo

Permitir medir de forma **reproducible** los tiempos de apertura de sesión, revisita e
interacción, para capturar una **línea base antes** de los cambios y comparar **después**
(FR-011). La instrumentación no altera el comportamiento visible ni envía datos al server.

## 2. Nombres de medidas

```ts
export const PERF_METRIC = {
  sessionOpen: 'graph.session.open',        // SC-001, SC-002
  sessionRevisit: 'graph.session.revisit',  // SC-003
  interaction: 'graph.interaction',         // SC-004
} as const;

export type TPerfMetricName = (typeof PERF_METRIC)[keyof typeof PERF_METRIC];
```

| Medida | Inicio | Fin | `detail` |
|--------|--------|-----|----------|
| `graph.session.open` | selección de una sesión **sin** estructura en caché | grafo con estructura no vacía y nodos encuadrados (`fitView` resuelto) | `{ nodeCount, phase: 'structure' }` |
| `graph.session.revisit` | selección de una sesión **con** estructura en caché | grafo mostrado desde caché | `{ nodeCount, phase: 'cache' }` |
| `graph.interaction` | transición de hover/selección/pan/zoom | pintado siguiente | `{ nodeCount, kind: 'hover' \| 'select' \| 'pan' \| 'zoom' }` |

`detail` **nunca** incluye contenido de mensajes ni textos del usuario (solo métricas
estructuradas).

## 3. API del helper (pura)

```ts
export const perfMark = (name: TPerfMetricName | string): void;
export const perfMeasure = (
  name: TPerfMetricName,
  startMark: TPerfMetricName | string,
  detail?: Record<string, unknown>,
): number | null;
```

- Basado en `performance.mark` / `performance.measure`.
- **No-op seguro** si `typeof performance === 'undefined'` o las funciones no existen
  (SSR/tests sin polyfill): devuelve `null` y no lanza.
- `perfMeasure` devuelve la `duration` (ms) de la medida registrada, para que los tests puedan
  aseverarla con un stub.
- Registro opcional en `console.debug` **solo** en `import.meta.env.DEV`.

## 4. Puntos de instrumentación

| Punto | Marca |
|-------|-------|
| `WorkspacePage` al cambiar `id` y detectar que la estructura **no** estaba cacheada | `perfMark(sessionOpen.start)` → `perfMeasure(sessionOpen, ...)` cuando el grafo tiene nodos |
| `WorkspacePage` al cambiar `id` con estructura cacheada | `perfMark(sessionRevisit.start)` → `perfMeasure(sessionRevisit, ...)` |
| `AgentGraph` en transición de hover/selección/pan/zoom | `perfMeasure(interaction, ...)` |
| `useGraphModel` (dev) | puede exponer `enrichment` agregado en el `detail` de open, sin marcar por nodo |

La marca de interacción se toma **por transición**, no por `mousemove`/frame (evita contaminar
la medición).

## 5. Cómo se captura la línea base (ver [quickstart.md](../quickstart.md))

1. **Antes**: con la implementación actual, exportar el perfil de DevTools y leer las entradas
   `graph.session.*`/`graph.interaction` en una muestra de sesiones (pequeña ≤ 5 agentes, grande
   ~50 agentes) con caché fría y con revisita.
2. **Después**: repetir la misma muestra y comparar p90 contra los objetivos SC-001..SC-004.
3. Los resultados alimentan la verificación de SC-001/SC-002/SC-003/SC-004 y se registran en el PR.

## 6. Criterios de aceptación del contrato

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| P1 | `perfMark`/`perfMeasure` registran la medida con el nombre correcto | spec puro `perf.spec.ts` con stub de `performance` |
| P2 | No-op sin `performance` (no lanza) | spec puro |
| P3 | `detail` acotado a métricas (sin contenido) | revisión + spec (forma del `detail`) |
| P4 | Open vs revisit se distinguen por presencia en caché | spec de `WorkspacePage` (mock de caché) |
| P5 | La interacción no marca por frame | spec de `AgentGraph` (número de medidas por transición) |
