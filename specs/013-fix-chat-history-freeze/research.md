# Phase 0 — Research: Histórico de sesiones en espera de respuesta sin congelar la interfaz

**Feature**: `013-fix-chat-history-freeze` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md)

Punto de partida (diagnóstico ya verificado, **no se re-diagnostica**): el bucle
`useBaseQuery` (efecto) → `QueryObserver.setOptions` (emite `observerOptionsUpdated`)
→ `useCachedForms` (`src/Domains/Chat/Hooks/useSessionAttention.ts`) → `sync()` →
`setForms(read())` → render → ∞. Reproducción mínima conocida: abrir el histórico
de un nodo `waiting-input` (spec de integración T028, hallazgo **F2** en
`.opencode/runs/012-refactor-workspace-enrichment/cambios_de_contrato.md` §2).

No hay `[NEEDS CLARIFICATION]` abiertos (la spec los resolvió en Clarifications:
alcance B —incluir preguntas de hijas— y medición A —sin presupuesto ms/CPU).

Entradas concretas del repositorio:

- `src/Domains/queryKeys.ts:41` — `forms(id) = ['sessions','forms',id]`.
- `src/Domains/queryKeys.ts:48` — `questions(id) = [...forms(id),'questions']`.
  El comentario (líneas 42-47) documenta el anidamiento **intencional**: liga la
  invalidación por prefijo de `forms(id)` (eventos `form.*`) a las preguntas.
- `src/Domains/Inspector/Inspector.service.ts:55-81` — `useSessionForms` observa
  `sessions.questions(id)` (`staleTime: Infinity`); al abrir el histórico de un
  nodo `waiting-input`, ese observador queda activo y emite `observerOptionsUpdated`.
- `src/Infrastructure/specs/integration/harness.tsx:763-788` — el arnés conserva
  **reales** `useSessionAttention` (`mockChatBarrel`) y `useSessionForms`
  (`mockInspectorBarrel`); por eso `fireEvent.click('Abrir histórico')`
  (`AgentGraphMarker`, línea 531) reproduce el bucle.
- `vitest.config.ts` — sin `testTimeout`: el defecto del timeout global es 5 s,
  pero un bucle de render síncrono no permite que el temporizador corte.

---

## R1 — Cómo filtrar los eventos de caché en `useCachedForms`

- **Decisión**: casar la clave **exacta** `['sessions','forms',id]`
  (`key.length === 3 && key[0] === 'sessions' && key[1] === 'forms' && ids.has(key[2])`,
  o comparación con `JSON.stringify(queryKeys.sessions.forms(id))`), en lugar del
  prefijo actual.
- **Rationale**: el filtro vigente (`key[0]==='sessions' && key[1]==='forms' && ids.has(key[2])`)
  casa `sessions.questions(id)` porque esa clave se anida a propósito bajo
  `forms(id)`. El índice de formularios crudos solo debe suscribirse a su propia
  clave; la coincidencia de prefijo es el disparador #1 del `sync()`.
- **Alternativas consideradas**:
  - *Mover `questions(id)` fuera del prefijo de `forms(id)`*: rompería la
    invalidación por prefijo documentada y tocaría `Inspector`/`Graph` (fuera de
    alcance, FR-007). Rechazada.
  - *Filtrar por longitud de la clave*: mismo efecto pero frágil ante futuras
    claves de longitud 3; la igualdad exacta es más explícita. Rechazada.

## R2 — Estabilidad referencial del índice devuelto por `read()`

- **Decisión**: `read()` mantiene en un `useRef` la última referencia producida y
  la **devuelve tal cual** cuando las listas `FormInfo[]` por sesión son las mismas
  (comparación por referencia de cada array leído). Solo construye un objeto nuevo
  si al menos una lista cambió.
- **Rationale**: `read()` hoy crea `const result = {}` en cada llamada, así que
  `setForms` nunca es igual por referencia y React no puede saltarse el update; con
  la memoización, `setState(prev)` con el mismo valor no re-renderiza (Principio
  VII, "estabilidad de referencias"). Esto neutraliza cualquier notificación
  redundante incluso sobre la clave exacta.
- **Alternativas consideradas**:
  - *`useSyncExternalStore`*: idiomático para suscribirse a stores externos y con
    snapshot cacheado, pero implica reescribir el hook y su contrato de snapshot;
    mayor superficie para un fix. Rechazada (más cambio del necesario).
  - *`useMemo` sobre un contador de versión*: equivalente en efecto, pero
    requiere un segundo estado por notificación. Rechazada.

## R3 — Qué eventos honrar

- **Decisión**: reaccionar **solo** a eventos portadores de dato (`type === 'updated'`);
  ignorar `observerOptionsUpdated`, `observerResultsUpdated`, `observerAdded`,
  `observerRemoved`, `added`/`removed` estructurales. Tipar el parámetro de
  `subscribe` con `{ type?: string; query: { queryKey: readonly unknown[] } }`.
- **Rationale**: `QueryObserver.setOptions` emite `observerOptionsUpdated`, que
  **no** es un cambio de dato; hoy el manejador lo trata como tal. Aun con R1, un
  observador sobre la clave exacta seguiría disparando `sync()` por esos eventos;
  R2 lo haría bailar, pero R3 elimina el trabajo inútil de raíz.
- **Alternativas consideradas**:
  - *Confiar solo en R2*: funcionalmente suficiente para el bucle reportado, pero
    deja que el manejador reaccione a eventos estructurales. Rechazada como única
    defensa (R2 y R3 juntas son la garantía FR-002).
  - *Confiar solo en R1*: no cubre notificaciones legítimas de la clave exacta ni
    fija identidad. Rechazada.

## R4 — Diseño de la prueba que hoy cuelga (FR-006 / US4)

- **Decisión**: dos capas complementarias.
  1. **Unitaria y acotada** en `src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx`:
     renderiza el hook sobre un grafo con un nodo `waiting-input` **y** un
     componente que registra un observador real sobre
     `queryKeys.sessions.questions(id)` (la clave de `useSessionForms`),
     reproduciendo la tormenta `observerOptionsUpdated`; tras un
     `setQueryData(sessions.forms(id), [...])` dentro de `act`, afirma que el
     resultado converge y enriquece el ítem con el `FormInfo` cacheado. `it` con
     `timeout` corto (p. ej. `2_000`). Incluye el **caso negativo** exigido por el
     Principio VIII: una notificación que no cambia el dato **no** produce un
     índice nuevo (identidad estable).
  2. **Integración (escenario de producto)** en
     `src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx`
     (NUEVO): siembra un nodo `waiting-input` (`sessions.forms` + `FormDetail`
     pendiente) y hace `fireEvent.click('Abrir histórico')` sobre
     `AgentGraphMarker`, afirmando que `HistoryModalMarker` monta con
     `data-node = <sesión>` y `data-question-count >= 1`; también con `timeout` corto.
- **Rationale**: FR-006 pide una prueba que no termina sobre el estado previo y
  pasa tras el fix. El cuelgue observado es un bucle síncrono de render que puede
  durar >3 min (el timeout por defecto de Vitest no lo interrumpe porque el hilo
  está ocupado y `vitest.config.ts` no fija `testTimeout`). La capa unitaria acota
  la reproducción de forma determinista (falla rápido) y la de integración prueba
  el escenario visible por el usuario (abrir el histórico). Ambas deben ser
  **rojas hoy** y **verdes** tras el arreglo.
- **Alternativas consideradas**:
  - *Solo integración* (restaurar el paso en `enrichmentSeeding.integration.spec.tsx`):
    fiel al hallazgo, pero un fallo pre-fix cuesta minutos y es hostil para CI.
    Rechazada como única capa; se conserva como capa de producto en un spec propio.
  - *Solo unitaria*: no ejerce el escenario de la US4 ("abrir el histórico") y
    la spec lo exige explícitamente. Rechazada como única capa.
  - *Añadir `testTimeout` global*: alteraría la configuración de toda la batería
    (fuera del alcance y con efecto colateral). Rechazada.

## R5 — Superficie congelada y no regresión

- **Decisión**: tocar únicamente
  `src/Domains/Chat/Hooks/useSessionAttention.ts` y añadir specs. **Sin** cambios
  en `src/Domains/queryKeys.ts`, `src/Domains/Inspector/Inspector.service.ts`,
  barrels públicos, UI, copy ni `data-testid`.
- **Rationale**: FR-007 (sin cambios de UI/copy/superficie) y la superficie
  congelada de la feature 012 (`cambios_de_contrato.md` §1). El arreglo es local
  y no altera lo observable del histórico ni de los badges (FR-003/FR-004/FR-005).
- **Alternativas consideradas**:
  - *Cambiar `queryKeys.sessions.questions(id)`*: toca Inspector/Graph y el
    contrato documentado de invalidación por prefijo. Rechazada.

---

**Salida de Phase 0**: todos los unknowns resueltos; 0 `NEEDS CLARIFICATION`
pendientes. Habilitado el diseño de Phase 1 (`data-model.md`, `contracts/`,
`quickstart.md`).
