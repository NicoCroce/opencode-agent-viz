# Quickstart — Raíces siempre listables, subárbol completo y paralelismo por invocación

**Feature**: `011-fix-session-roots-subtree`
Guía de **validación manual** end-to-end de lo construido. Entidades: [data-model.md](./data-model.md). Reglas: [contracts/](./contracts/).

Los criterios se verifican sobre **"todas las raíces del proyecto"**, no sobre un número fijo: el store es un blanco móvil. Las cifras solo aparecen en la sección [Medición registrada](#medición-registrada-t053), como instrumentación fechada.

## Prerrequisitos

- `pnpm install` (sin dependencias nuevas).
- Servidor de OpenCode accesible; proxy Vite `/oc` operativo.
- Store de referencia del proyecto: bosque **plano** (raíces con hijos directos y sin nietos) y muchas más hijas que raíces. Un proyecto con decenas de raíces y cientos de hijas es suficiente para que el bug original fuera visible.

## Comandos

```bash
pnpm test          # Vitest + Testing Library
pnpm tsc           # TypeScript strict
pnpm lint          # ESLint strict
pnpm dev           # app local (validación manual)
```

Comandos contra el servidor, tal como están en el plan aprobado (`discovery/pedido.md` §9):

```bash
# 1. El server devuelve las raíces correctas
opencode api get "/api/session?directory=$PWD&parentID=null&limit=200&order=desc"

# 2. Suite completa + tipos + lint
pnpm test
pnpm tsc
pnpm lint

# 3. Manual: /sessions muestra 37 raíces; deep link a ses_ee308fe0 renderiza 51 nodos
```

> El paso 3 de §9 cita las cifras del store medido el 2026-10-12. Hoy se lee como: `/sessions` muestra **todas las raíces** y el deep link a cualquier raíz renderiza **su subárbol**. Para enumerar raíces e hijas de forma portable se usa el paso 1 (`parentID=null`) y, para las hijas de una raíz, el mismo endpoint con `parentID=<id>` (el que codifica `listChildSessions`, `pedido.md` §6/T007).

## Escenario 1 — Todas las raíces, ninguna hija (US1, FR-001/002)

1. Enumerar las raíces del proyecto con el comando §9 (`parentID=null`); el listado puede ocupar más de una página (cursor) y el visor las recorre todas.
2. Abrir `/sessions` y el riel.
3. **Esperado**: aparecen **todas las raíces del proyecto** y **0 hijas** (comparar contra el paso 1, ítem por ítem); dentro de cada carpeta, orden por última actividad descendente.
4. **Regresión del bug**: ninguna raíz antigua queda fuera. Comparar con la ventana sin filtrar (`limit=200&order=desc`): hay raíces que **no** aparecen ahí y **sí** deben aparecer en el listado.
5. Si el volumen supera el tope (200 raíces × 25 páginas = 5.000 raíces/directorio), aparece el aviso de corte (Escenario 4); nunca un listado incompleto mostrado como completo.

## Escenario 2 — Enlace directo a una raíz fuera del listado (US2, FR-003/004/005)

1. Elegir una raíz que **no** esté en la ventana sin filtrar del paso 4 anterior (las que el bug ocultaba) y abrir `/?id=<esa-raíz>`.
2. **Esperado**: el `directory` se resuelve vía `session.get` (no depende de `items`); el grafo muestra esa raíz y su subárbol completo, **sin skeleton terminal**. Si es descendiente, se resuelve el directorio y se muestra el subárbol desde su raíz.
3. Abrir `/?id=<id-inexistente>` → estado **"no encontrada"** con acción a `/sessions` (distinto de "sin agentes").
4. Provocar fallo de red → `EmptyScreenError` con reintento.
5. **Criterio (SC-002)**: 0 casos de carga terminal sin salida; toda carga termina en datos, vacío con acción o error.

## Escenario 3 — Subárbol completo o truncado declarado (US4, FR-006)

1. Abrir el grafo de una raíz con descendientes que no están en la ventana de sesiones.
2. **Esperado**: el grafo incluye **todo** el subárbol alcanzable (raíz + todos sus descendientes). Contrastar con las hijas enumeradas por `parentID=<id>`: ningún recorte silencioso, ningún grafo vacío.
3. Forzar el presupuesto global `SUBTREE_MAX_NODES` (en un entorno/dev temporal, p. ej. bajándolo a un valor menor que el subárbol observado; también cubierto por `useGraphStructure.spec.tsx`).
4. **Esperado** con presupuesto forzado: aparece el banner `GraphTruncationBanner` (título "Vista parcial", `data-testid="graph-truncation-banner"`, `role="status"`, `aria-live="polite"`, **sin cifras y sin acción**), situado **entre la cabecera y el lienzo**; el grafo sigue usable.
5. Subárbol completo → **sin** banner.

## Escenario 4 — Corte del listado declarado (SC-009)

1. Forzar `SESSION_MAX_PAGES` a un valor bajo en un entorno de prueba (no hay variable de entorno; es constante, `Services/lib/sessionPagination.ts`; también cubierto por `sessionPagination.spec.ts` y `session.service.spec.ts`).
2. **Esperado**: mismo banner informativo que el subárbol; el listado **no** se presenta como completo.

## Escenario 5 — Paralelismo por invocación (US5, FR-007/008/011/016)

1. Abrir una ejecución cuyo padre haya invocado subagentes en pasos distintos, con al menos una hija **reutilizada** en dos pasos (el store medido tiene ejecuciones así; también hay fixtures en `Graph/lib/specs/`).
2. **Esperado**: cada invocación es una unidad; los pasos secuenciales quedan en filas/lotes distintos; la hija reutilizada aporta **dos** invocaciones (no un único intervalo largo).
3. Comparar la **fila** con el **badge** del mismo nodo → **mismo veredicto** (paridad fila↔badge, SC-004).
4. Un padre sin mensajes cargados conserva el agrupamiento estructural (respaldo por sesión, FR-012): abrir el grafo y comprobar que no hay regresión antes de que lleguen los mensajes.
5. **Nota documentada (FR-008)**: la **barra** del nodo mantiene el intervalo de la sesión; filas y badge van por invocación. La diferencia es intencional y no se unifica.

## Escenario 6 — Skills cargadas (US6, FR-009/010)

1. Abrir el Inspector de una sesión que cargó una skill (parte `tool` con `name: 'skill'` en estado `completed`).
2. **Esperado**: `nombre · ~N tokens` (el `~` rotula la estimación aproximada, caracteres/4; `aria-label` dice "aproximadamente"). Nunca se presenta como coste real.
3. Skill cargada varias veces → se reflejan las repeticiones. Skill en estado `error`/denegada → **no** cuenta como cargada.
4. Skill identificada por `input.id` (no solo por `input.name`) → también se lista.
5. Sesión sin skills → **"Sin skills cargadas"**, visible aunque el resto de secciones esté vacío.

## Escenario 7 — Suite y contratos

1. `pnpm test && pnpm tsc && pnpm lint`.
   - `pnpm lint` → verde.
   - `pnpm tsc` → **7 errores de tipo preexistentes** en `src/Domains/Graph/lib/specs/invocations.spec.ts` (fixtures del tool part). **Pendiente en converge**, ajeno a esta unidad.
   - `pnpm test` → **6 tests preexistentes en rojo** (`useGraphEnrichment.freshness.spec.tsx` ×1, `useGraphModel.tick.spec.tsx` ×2, `WorkspacePage.spec.tsx` ×3). **Pendiente en converge**, ajeno a esta unidad.
2. Los contratos de `specs/006` y `specs/007` quedan actualizados (ver [contracts/README.md](./contracts/README.md)); sin cambios de comportamiento preexistentes más allá de los agregados y las actualizaciones previstas (SC-008).

## Medición registrada (T053)

`loadedCount`/`reason`/`truncated` los expone `useGraphStructure` → `useGraphModel` de forma aditiva (`data-model.md` §3); en runtime se inspeccionan con React Query Devtools (`sessions.roots(directory)`, `sessions.children(parentID)`), en el resultado del hook o en el banner.

Medición del store del proyecto (2026-10-13, comandos §9 + `parentID=<id>`):

| Magnitud | Valor medido |
|---|---|
| Raíces paginadas (`parentID=null`, cursor) | 38 en 2 páginas; 0 hijas filtradas |
| Hijas totales del proyecto | 494 (suma por raíz); repartidas en 13 raíces con hijos |
| Profundidad del árbol | **1** (bosque plano; 0 nietos en 160 hijos sondeados) |
| Grafo de la raíz mayor (`ses_ed8a1bdd0ffe1D692RdYjr6Udw`) | `loadedCount = 110` (raíz + 109 hijas), `truncated = false`, `reason = null`, 110 requests internos (uno por nodo interno en bosque plano) |
| Presupuesto | `SUBTREE_MAX_NODES = 200` (el store medido queda por debajo: nunca trunca) y `SESSION_MAX_PAGES × SESSION_PAGE_SIZE = 5.000` raíces (tampoco se alcanza) |

Consecuencia: en el store medido **no** se activa el corte por presupuesto, así que su camino se valida por spec/forzado (Escenarios 3 y 4), no por espera pasiva. La reducción de payload del listado se valida con `WorkspacePage.perf.spec.tsx` (la estructura se alimenta de `listRootSessions` y `listSessions` deja de llamarse), sin fijar cifras en el criterio (SC-005).
