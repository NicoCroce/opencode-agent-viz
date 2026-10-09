# Quickstart — Filas paralelas correctas en el grafo en vivo

**Feature**: `007-fix-parallel-lanes-live`
**Objetivo**: validar de extremo a extremo que los subagentes paralelos comparten fila **mientras corren** (sin refrescar), que el refresco no cambia la disposición y que la semántica secuencial vs. paralela se preserva.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/).

---

## Prerrequisitos

- Node.js y dependencias instaladas: `npm install`.
- Para la validación manual: una instancia de OpenCode server accesible vía el proxy de Vite (`OPENCODE_URL`).
- Una **muestra de ejecuciones representativa**:
  - una sesión que lanza **N ≥ 3 subagentes concurrentes** (hermanos con actividad solapada);
  - una sesión con subagentes **secuenciales** (uno termina antes de que arranque el siguiente);
  - una sesión con **dos grupos paralelos consecutivos**;
  - una ejecución **en curso** observable de principio a fin (para ver la transición activo→terminado).
- Navegador con DevTools.

---

## 1. Validación automatizada (obligatoria)

```bash
# Núcleo del dominio Graph (libs puras + hooks + componentes)
npx vitest run src/Domains/Graph

# Reducer y aplicación de eventos
npx vitest run src/Domains/Graph/lib/specs/eventReducer.spec.ts
npx vitest run src/Infrastructure

# Suite completa + tipos + lint (puerta de calidad del repo)
npm test
npm run tsc
npm run lint
```

**Esperado**: verde. Los specs de esta feature:

- `nodeInterval.spec.ts` (extendido) — `executionInterval` abre activos (`+∞`) y cierra terminados con fin real; `endOf` activo → `now` (E1).
- `parallelism.spec.ts` (extendido) — activos concurrentes creados con diferencia comparten grupo; secuenciales no; badge = filas (E2, E8).
- `executionKey.spec.ts` (nuevo) — cambia con topología y clase/borde de intervalo; estable ante eventos no estructurales (E3).
- `deriveExecutionLayout.spec.ts` (nuevo) — plan/posiciones/grupos coherentes, sin mutar la entrada (E4).
- `eventReducer.spec.ts` (extendido) — `reduceActivity` cubre todos los eventos con `sessionID`; `setActivity` monótono (A1, A2).
- `useGraphStructure.spec.tsx` (extendido) — plan estructural correcto y sin consultas de contenido (E6, preserva L4 de 006).
- `useGraphModel.spec.tsx` (extendido) — filas paralelas en vivo desde el modelo enriquecido, estables tras refresco, sin saltos por tick (E5, E7, A5).
- `applyReducedEvent` spec — aplica la actividad sin alterar `reduceEvent` (A3).
- `buildGraph.spec.ts` (extendido) — `updatedAt = max(lista, actividad)` (A4).

Opcional, si hay server real disponible:

```bash
npm run test:live   # integración contra el server Vía VIZ_API_URL + OPENCODE_PASSWORD
```

---

## 2. Validación manual

### US1 — Subagentes paralelos en una sola fila en vivo (P1 · FR-001..FR-004, SC-001, SC-002)

1. Abrir la sesión que lanza **N subagentes concurrentes** y observar el grafo durante el stream.
   - **Esperado**: los N aparecen en la **misma fila** a medida que se crean, sin apilarse (US1 esc. 1, SC-001).
2. Con la ejecución aún en curso, **refrescar** la vista.
   - **Esperado**: la disposición no cambia (mismos subagentes, misma fila) (US1 esc. 2, SC-002).
3. Tras finalizar, inspeccionar el grafo.
   - **Esperado**: el agrupamiento coincide con el visto durante la ejecución (US1 esc. 3, SC-005).

### US2 — Secuenciales en filas distintas (P2 · FR-005, SC-003)

1. Ejecutar un padre que lanza un subagente, espera a que **termine** y recién entonces lanza otro.
   - **Esperado**: cada uno en una **fila consecutiva distinta**, en vivo y tras refrescar (US2 esc. 1, SC-003).
2. Un padre que lanza un grupo paralelo y luego otro grupo paralelo posterior.
   - **Esperado**: cada grupo comparte su propia fila; los grupos quedan en filas distintas (US2 esc. 2).

### US3 — Sin saltos durante la ejecución (P3 · FR-007, SC-004)

1. Con subagentes paralelos ya en una fila, dejar correr eventos de contenido (texto, tools) y de estado.
   - **Esperado**: **0 saltos** de fila/orden; los nodos no se mueven (US3 esc. 1, SC-004).
2. Dejar pasar varios ciclos del reloj vivo (1 s).
   - **Esperado**: las duraciones avanzan, pero la fila y el orden no cambian (FR-007).

### Edge cases

- **Creados con milisegundos de diferencia**: se agrupan por solape real de actividad, no por "casi al mismo tiempo".
- **Duración real muy corta**: subagentes que corren juntos se agrupan si su actividad solapó.
- **Sesión sin marca de fin**: no se interpreta como duración cero ni se pierde; cae a `metrics.endedAt`/fin real.
- **Terminado durante la observación**: al pasar de activo a terminado conserva un fin real; el agrupamiento final coincide con el de la vista reabierta.
- **Reconexión del stream**: la disposición no se degrada respecto de antes de la desconexión.
- **Muchos hermanos concurrentes**: siguen distribuyéndose en columnas sin pérdida.
- **Raíz única sin subagentes**: sin regresión.

---

## 3. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| SC-001 | N concurrentes en una sola fila durante el stream (US1 esc. 1; specs E2/E5). |
| SC-002 | Refrescar no cambia fila/orden (US1 esc. 2; specs A5/E5). |
| SC-003 | Secuenciales en filas distintas (US2 esc. 1; spec E2). |
| SC-004 | 0 saltos ante eventos no estructurales/tick (US3; specs E3/E7). |
| SC-005 | Disposición en vivo = disposición reconstruida al reabrir (US1 esc. 3; specs A5/E5). |
| FR-009 | Desfase de la marca de actividad ≤ 1 s (specs A1..A4). |
| FR-010 | Badge de paralelismo coherente con la fila (spec E2/E8). |

---

## 4. Salida esperada

- Specs verdes, `tsc`/`lint` sin errores.
- Confirmación manual de SC-001..SC-005 sobre la muestra.
- Evidencia (capturas/notas) de que la disposición en vivo coincide con la reconstruida al reabrir.
