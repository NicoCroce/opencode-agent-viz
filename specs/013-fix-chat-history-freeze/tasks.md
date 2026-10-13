---
description: "Task list for 013-fix-chat-history-freeze"
---

# Tasks: Histórico de sesiones en espera de respuesta sin congelar la interfaz

**Input**: Design documents from `/specs/013-fix-chat-history-freeze/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/attention-forms-subscription.md](./contracts/attention-forms-subscription.md),
[quickstart.md](./quickstart.md), `.specify/memory/constitution.md`

**Tests**: SÍ solicitados — la spec los exige (FR-006 "prueba que hoy no termina y que con la corrección
pasa"; US1/US2/US3/US4 tienen *Independent Test* explícito; Principio VIII exige el caso negativo). Las
dos capas de regresión (unitaria y de integración) se escriben **rojas** antes de la corrección.

**Organization**: por historia de usuario (US1 P1 = abrir sin congelar; US2 P1 = contenido intacto;
US3 P2 = resto de sesiones sin cambios; US4 P2 = defecto cubierto por pruebas que hoy cuelgan).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencia de tareas incompletas).
- **[Story]**: US1 / US2 / US3 / US4. Setup, Foundational y Polish no llevan etiqueta.
- Cada descripción lleva las rutas exactas de los archivos que escribe (`writes:`).

## Ficheros intocables (FR-007/FR-009 — solo lectura, PROHIBIDO en cualquier `writes`)

| Fichero | Motivo |
|---|---|
| `src/Infrastructure/specs/WorkspacePage.spec.tsx` | suite protegida de la página (012) |
| `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx` | suite protegida de rendimiento (012) |
| `src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx` | suite protegida del enriquecimiento (012) |
| `src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx` | suite protegida de frescura/siembra (012) |
| `src/Domains/Chat/Hooks/specs/*.spec.tsx` (salvo `useSessionAttention.spec.tsx`) | specs existentes: `useChatController`, `useChatAutoScroll`, `useChatDraft`, `useAttentionNotifications` |

El resto de specs existentes de `src/Infrastructure/specs/integration/` (incluido `workspaceHistoryData.integration.spec.tsx`)
también es **solo lectura**: esta feature añade specs nuevas, no edita las de 012. El arnés
`src/Infrastructure/specs/integration/harness.tsx` se **reutiliza sin cambios** (plan.md §Structure Decision).

## Unidades y fronteras (base de las tareas E2E)

Unidades: **U2**=`Infrastructure/Hooks` (`useAttentionByRoot`/`useAttentionNodeIds`), **U3**=`Infrastructure/Components`,
**U4**=`Domains/Chat` (`useSessionAttention`/`useCachedForms` + badge), **U5**=`Domains/Sessions` (rail),
**U6**=`Domains/Graph` (enriquecimiento y siembra de `sessions.forms(id)`), **U7**=`Domains/Inspector`
(`useSessionForms` → `sessions.questions(id)`), **U8**=`Domains/History` (overlay).

Toda cadena de estado del contrato que cruza dos unidades tiene **un dueño E2E** con caso negativo
(dato inexistente / vacío). Ninguna frontera queda sin dueño:

| Frontera | Cadena de estado (contracts §) | Dueño E2E | Caso negativo |
|---|---|---|---|
| U7 ↔ U4 | observador real sobre `sessions.questions(id)` (`useSessionForms`, §2/§4) → suscripción `useCachedForms` | **T006** `workspaceHistoryWaitingInput.integration.spec.tsx` | `questions(id)` ausente/vacío ⇒ abre sin cuelgue, `data-question-count=0` |
| U6 ↔ U4 | `sessions.forms(id)` + `FormDetail` cacheados (grafo) → índice enriquecido (§2/§3/§5) | **T012** `workspaceAttentionFormsIndex.integration.spec.tsx` | `sessions.forms(id)` vacío ⇒ respaldo `question:<sessionId>`, sin cuelgue |
| U4 ↔ U5 | índice `TAttentionItem[]` → badge por raíz (`countAttentionByRoot`, §5) | **T014** `workspaceAttentionBadgeStability.integration.spec.tsx` | sesión fuera del subárbol / sin forms ⇒ conteo `0` |
| U2 ↔ U7/U8 | `useHistoryData` → `HistoryOverlay` (questions/`missingId`) | `workspaceHistoryData.integration.spec.tsx` (012/T022, ya dueño) | `targetId` inexistente ⇒ `missingId` (404) + `clearMissing` |

Las tres tareas E2E nuevas (T006, T012, T014) declaran `timeout` corto (`2_000`) para que un cuelgue
**falle en lugar de eternizarse** (research R4; `vitest.config.ts` no fija `testTimeout`).

## Ficheros de producto (`writes`) de esta feature

- `src/Domains/Chat/Hooks/useSessionAttention.ts` — único fichero de producto (T007–T009).
- `src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx` — spec existente que **se amplía** (T005, T011).
- `src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx` — NUEVO (T006).
- `src/Infrastructure/specs/integration/workspaceAttentionFormsIndex.integration.spec.tsx` — NUEVO (T012).
- `src/Infrastructure/specs/integration/workspaceAttentionBadgeStability.integration.spec.tsx` — NUEVO (T014).
- `specs/013-fix-chat-history-freeze/baseline.md` — línea base y cierre (T001–T004, T015, T016, T018).

---

## Phase 1: Setup (línea base de no regresión)

**Purpose**: fijar el verde de partida antes de tocar código, para comparar la no regresión (SC-005/FR-009),
como en la feature 012. Sin esta fase no hay prueba de que la corrección no cambió nada fuera del defecto.

- [X] T001 Ejecutar la línea base completa y registrarla (archivos + nº de tests + duración + verde/rojo):
  `pnpm test` y las suites que se van a tocar o proteger por separado
  (`pnpm test -- src/Domains/Chat/Hooks/specs src/Infrastructure/specs/WorkspacePage.spec.tsx
  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx`); crear
  `specs/013-fix-chat-history-freeze/baseline.md` con una tabla (suite, fichero, nº tests, duración,
  verde/rojo) y el `git rev-parse HEAD` de partida (`0eebec68`). `writes: specs/013-fix-chat-history-freeze/baseline.md`
- [X] T002 Anexar a `baseline.md` la línea base de compuertas y de alcance: `pnpm tsc`, `pnpm tsc:node`,
  `pnpm lint` (0 errores), `git status --short` y `git diff --name-only -- src/Infrastructure/specs src/Domains/Graph/Hooks/specs`
  (debe salir vacío); registrar los `sha256` de los 5 ficheros intocables para el arbitraje de T015/T018.
  `writes: specs/013-fix-chat-history-freeze/baseline.md`

---

## Phase 2: Foundational (Bloqueante)

**Purpose**: fijar el mapa de fronteras y confirmar que el arnés de integración sirve tal cual (sin reimplementar
nada). Bloquea la escritura de cualquier prueba de las historias.

**⚠️ CRITICAL**: ninguna prueba de historia se escribe hasta cerrar esta fase.

- [X] T003 Anexar a `baseline.md` el **mapa de fronteras y dueños E2E** (tabla anterior) y confirmar los
  invariantes del contrato §1–§7 que guían las tareas: clave exacta `['sessions','forms',id]`, identidad
  estable de `read()`, solo eventos `type === 'updated'`, superficie congelada, terminación.
  `writes: specs/013-fix-chat-history-freeze/baseline.md`
- [X] T004 Verificar **solo lectura** que el arnés de integración conserva reales `useSessionAttention`
  (`mockChatBarrel`) y `useSessionForms` (`mockInspectorBarrel`) y que `AgentGraphMarker` emite
  `Abrir histórico` con `onOpenHistory` sobre el primer nodo (harness.tsx líneas 531/763-788), y anotar la
  convención de `timeout: 2_000` en los `it` de regresión (research R4). Sin escrituras de producto.
  `writes: specs/013-fix-chat-history-freeze/baseline.md`

**Checkpoint**: fronteras con dueño y arnés confirmado — pueden empezar las historias.

---

## Phase 3: User Story 1 - Abrir el histórico de una sesión en espera sin congelar (Priority: P1) 🎯 MVP

**Goal**: abrir el histórico de un nodo `waiting-input` termina; la interfaz responde y no hay reciclado de
render (FR-001/FR-002). Incluye el filtro por clave exacta (R1), la identidad estable del índice (R2) y los
eventos portadores de dato (R3) en `useCachedForms`.

**Independent Test**: sobre un grafo con nodo `waiting-input` y un observador real sobre `sessions.questions(id)`
sembrado, montar `useSessionAttention` y escribir `sessions.forms(id)`: converge con el ítem enriquecido; y
abrir el histórico de ese nodo termina con `data-node` = sesión y `data-question-count >= 1`.

### Tests for User Story 1 ⚠️ (escribir PRIMERO, deben ser rojos)

- [X] T005 [P] [US1] Ampliar `src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx`: montar `useSessionAttention`
  sobre un grafo con nodo `waiting-input` **y** un componente que registre un observador real sobre
  `queryKeys.sessions.questions(id)` (reproduce la tormenta `observerOptionsUpdated`); dentro de `act`, escribir
  `sessions.forms(id)` con un `FormInfo` pendiente y afirmar convergencia + enriquecimiento (`id`/`title` del
  formulario) y **caso negativo** (Principio VIII): una notificación que **no** cambia el dato no produce un
  índice nuevo (identidad estable, sin nuevo estado). `it(..., { timeout: 2_000 })`.
  `writes: src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx`
- [X] T006 [P] [US1] Crear la regresión E2E que hoy cuelga (FR-006/US4):
  `src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx`. Reutilizar el arnés
  (`createIntegrationQueryClient`, `seedSessions`, `seedSubtree`, `seedDevice`, `seedForms` con
  `bySession`+`details` de un formulario `pending`, `renderWorkspace`, `TESTID.agentGraph/historyModal`) y los
  `vi.mock` por barrel del arnés; `fireEvent.click('Abrir histórico')` sobre `AgentGraphMarker` y afirmar que
  `HistoryModalMarker` monta con `data-node = <sesión>` y `data-question-count >= 1`. **Caso negativo**: sin
  `sessions.questions(id)`/`sessions.forms(id)` (dato inexistente/vacío) el histórico abre igual, sin cuelgue,
  con `data-question-count = 0`. `it(..., { timeout: 2_000 })`. Este spec **no termina hoy** (rojo) y debe
  pasar tras T007–T009. `writes: src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx`

### Implementation for User Story 1

- [X] T007 [US1] (R1) Cambiar el filtro de `useCachedForms` (líneas 100-112) de **prefijo** a **clave exacta**
  `['sessions','forms',id]`: `key.length === 3 && key[0] === 'sessions' && key[1] === 'forms' && ids.has(key[2])`,
  de modo que no reaccione a `sessions.questions(id)` (`['sessions','forms',id,'questions']`). Mantener sin cambios
  `queryKeys.ts`, `Inspector.service.ts`, barrels, UI/copy. `writes: src/Domains/Chat/Hooks/useSessionAttention.ts`
- [X] T008 [US1] (R2) Hacer `read()` (líneas ~66-87) **referencialmente estable**: cachear en un `useRef` la última
  referencia y devolverla tal cual cuando todas las listas `FormInfo[]` por sesión son las mismas (comparación por
  referencia); construir un objeto nuevo **solo** si al menos una lista cambió, para que `setForms` no provoque
  render cuando el dato no cambió (Principio VII). `writes: src/Domains/Chat/Hooks/useSessionAttention.ts`
- [X] T009 [US1] (R3) Tipar el evento de `subscribe` como `{ type?: string; query: { queryKey: readonly unknown[] } }`
  y reaccionar **solo** a `type === 'updated'`, ignorando `observerOptionsUpdated`/`observerResultsUpdated`/`observer*`
  (líneas 91-112). `writes: src/Domains/Chat/Hooks/useSessionAttention.ts`
- [X] T010 [US1] Ejecutar y dejar **verde** la regresión de la historia:
  `pnpm test -- src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx
  src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx`; registrar el resultado
  (verde/duración) en `baseline.md`. `writes: specs/013-fix-chat-history-freeze/baseline.md`

**Checkpoint**: US1 funcional y testeable de forma independiente (MVP).

---

## Phase 4: User Story 2 - El histórico sigue mostrando las preguntas abiertas como hoy (Priority: P1)

**Goal**: el `kind: 'question'` conserva `id`/`title` del `FormInfo` cacheado de `sessions.forms(id)` y, sin
formulario, el respaldo (`question:<sessionId>`, título del nodo); sin diferencias de texto/etiqueta/posición
(FR-003). Incluye la frontera U6↔U4 con dueño E2E.

**Independent Test**: abrir el histórico de una sesión `waiting-input` y comprobar que las preguntas aparecen con
el mismo contenido; con `sessions.forms(id)` vacío el ítem conserva el respaldo, sin cuelgue.

### Tests for User Story 2

- [X] T011 [US2] Ampliar `src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx` con las aserciones de
  contenido: (a) con `FormInfo` cacheado el ítem de pregunta toma su `id`/`title`; (b) sin `FormInfo` (lista vacía)
  conserva el respaldo `id = question:<sessionId>` y el título del nodo; (c) las preguntas de sesiones **hijas**
  del subárbol se enriquecen igual. Ejecutar además
  `pnpm test -- src/Infrastructure/specs/integration/workspaceHistoryData.integration.spec.tsx` (solo lectura, T022)
  para confirmar el cableado del overlay. `writes: src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx`
- [X] T012 [P] [US2] Crear el E2E de frontera **U6↔U4**:
  `src/Infrastructure/specs/integration/workspaceAttentionFormsIndex.integration.spec.tsx`. Sembrar con el arnés
  `sessions.forms(id)` + `FormDetail` pendiente de un nodo `waiting-input` del subárbol y afirmar que la cadena
  `sessions.forms(id)` (grafo) → índice `useCachedForms` → ítem enriquecido llega al nodo/atención sin cuelgue.
  **Caso negativo**: `sessions.forms(id)` **vacío** ⇒ respaldo `question:<sessionId>` y ningún error/cuelgue.
  `timeout: 2_000`. `writes: src/Infrastructure/specs/integration/workspaceAttentionFormsIndex.integration.spec.tsx`

**Checkpoint**: US1 y US2 verdes de forma independiente; contenido del histórico intacto.

---

## Phase 5: User Story 3 - El resto de sesiones no cambia (Priority: P2)

**Goal**: otras sesiones (incluidas espera de permiso) y los badges de atención conservan comportamiento,
conteos y etiquetas (FR-004/FR-005/FR-009). Incluye la frontera U4↔U5 con dueño E2E.

**Independent Test**: abrir el histórico de sesiones que no están en espera de respuesta y comprobar que su
histórico y sus badges se comportan igual que hoy; el conteo por raíz no cambia cuando el dato no cambió.

### Tests for User Story 3

- [X] T013 [US3] Ejecutar y registrar en `baseline.md` la no regresión de las suites protegidas e intocables
  (comparar contra T001/T002): `pnpm test -- src/Infrastructure/specs/WorkspacePage.spec.tsx
  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx
  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx
  src/Domains/Chat/Hooks/specs` (estos últimos sin cambios salvo `useSessionAttention.spec.tsx`).
  `writes: specs/013-fix-chat-history-freeze/baseline.md`
- [X] T014 [P] [US3] Crear el E2E de frontera **U4↔U5**:
  `src/Infrastructure/specs/integration/workspaceAttentionBadgeStability.integration.spec.tsx`. Con el arnés,
  sembrar un subárbol con pendientes y afirmar que el conteo por raíz (`SessionListMarker` `data-attention`,
  `useAttentionByRoot`/`countAttentionByRoot`) refleja el índice `useSessionAttention` con los conteos/etiquetas
  de hoy y **no cambia** ante una notificación sin cambio de dato (identidad estable). **Caso negativo**: sesión
  fuera del subárbol / sin `sessions.forms(id)` ⇒ conteo `0`. `timeout: 2_000`.
  `writes: src/Infrastructure/specs/integration/workspaceAttentionBadgeStability.integration.spec.tsx`

**Checkpoint**: comportamiento general intacto; badges sin cambios.

---

## Phase 6: User Story 4 - El defecto queda cubierto por una prueba que hoy cuelga (Priority: P2)

**Goal**: demostrar y dejar registrado que la regresión reproduce el defecto sobre el estado previo (rojo) y
pasa tras la corrección, y que las tres fronteras E2E quedan cubiertas (FR-006/SC-005).

**Independent Test**: ejecutar `workspaceHistoryWaitingInput.integration.spec.tsx` y la regresión unitaria
sobre el estado previo (fix revertido) → no terminan/fallan; con el fix aplicado → pasan, y el resto de la
batería sigue verde.

- [X] T015 [US4] Verificación rojo→verde: revertir temporalmente T007–T009 (`git stash` del fichero de producto o
  `git checkout <HEAD~> -- src/Domains/Chat/Hooks/useSessionAttention.ts`) y ejecutar la regresión
  (`workspaceHistoryWaitingInput` + `useSessionAttention.spec`) para constatar el **rojo hoy** (cuelgue/timeout
  corto, no >3 min); restaurar el fix y re-ejecutar para dejarla **verde**. Registrar ambas ejecuciones
  (estado, fichero, duración) en `baseline.md`. `writes: specs/013-fix-chat-history-freeze/baseline.md`
- [X] T016 [US4] Cobertura E2E completa de las fronteras: ejecutar en una sola pasada las tres specs de frontera
  (`workspaceHistoryWaitingInput`, `workspaceAttentionFormsIndex`, `workspaceAttentionBadgeStability`) junto con
  la regresión unitaria y `workspaceHistoryData.integration.spec.tsx`; confirmar que cada frontera tiene dueño
  con su caso negativo y registrar el resultado en `baseline.md`.
  `writes: specs/013-fix-chat-history-freeze/baseline.md`

**Checkpoint**: todas las historias independientemente funcionales y el defecto cubierto.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T017 [P] Cierre estático y batería completa (quickstart Escenario 4): `pnpm test`, `pnpm tsc`,
  `pnpm tsc:node`, `pnpm lint` (0 errores); confirmar que el nº de tests no baja de la referencia de T001.
- [X] T018 Comparación final de no regresión en `baseline.md`: contraste T001 vs T017 (nº de tests, duración,
  suites verdes), `sha256` de los intocables idéntico al de T002 (0 cambios) y cierre del mapa de fronteras
  (cada una con dueño E2E y caso negativo). `writes: specs/013-fix-chat-history-freeze/baseline.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **BLOQUEA** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Sus tests (T005, T006) preceden a la implementación (T007–T009).
- **US2 (Phase 4)**: depende del fichero de producto estable (T007–T009).
- **US3 (Phase 5)**: depende de Foundational; T013/T014 no rompen US1/US2.
- **US4 (Phase 6)**: cierra la verificación; T015 depende de T007–T009 y T005/T006; T016 depende de T012/T014.
- **Polish (Phase 7)**: depende de todas las historias.

### Within Each User Story

- Tests **rojos** antes de la implementación (T005/T006 antes de T007–T009).
- R1 → R2 → R3 en el mismo fichero (`useSessionAttention.ts`): secuenciales, nunca `[P]`.
- Cada spec E2E nueva en su propio archivo: `[P]` entre sí y respecto de la unitaria.

### Parallel Opportunities

- **US1**: T005 y T006 son `[P]` (archivos distintos); T007–T009 son secuenciales (mismo fichero).
- **US2/US3**: T012 y T014 son `[P]` (archivos nuevos distintos); T011 y T013 comparten `baseline.md`/el spec unitario.
- Con capacidad, US2 y US3 pueden abordarse en paralelo tras Foundational; US1 debe ir primero por prioridad.

---

## Parallel Example: User Story 1

```bash
# Lanzar juntas las dos regresiones rojas de US1 (archivos distintos):
Task: "Regresión unitaria en src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx"
Task: "Regresión E2E en src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx"
```

## Parallel Example: Fronteras E2E (US2/US3)

```bash
# Dueños E2E de fronteras distintas, sin conflicto de archivos:
Task: "U6↔U4 en workspaceAttentionFormsIndex.integration.spec.tsx"
Task: "U4↔U5 en workspaceAttentionBadgeStability.integration.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (línea base) → 2. Phase 2: Foundational (fronteras + arnés) → 3. Phase 3: US1
   (escribir regresiones rojas, aplicar R1/R2/R3, dejar verde) → **STOP y VALIDAR** US1.
4. Con US1 verde la interfaz ya no se congela: MVP desplegable.

### Incremental Delivery

1. US1 → abrir el histórico termina (MVP).
2. US2 → contenido de las preguntas intacto (frontera U6↔U4 cubierta).
3. US3 → resto de sesiones y badges sin cambios (frontera U4↔U5 cubierta).
4. US4 → rojo→verde probado y tres fronteras E2E con dueño y caso negativo.
5. Polish → batería y estáticos verdes, comparación de no regresión cerrada.

---

## Notes

- [P] = archivos distintos, sin dependencias. El fichero de producto (`useSessionAttention.ts`) y
  `baseline.md` son puntos de serialización.
- Prohibido tocar `queryKeys.ts`, `Inspector.service.ts`, barrels, UI, copy ni `data-testid` (FR-007).
- Cada spec E2E nueva declara un `timeout` propio. **Desviación aplicada (D1)**: se usó `15_000`, no `2_000`
  (ver `baseline.md` §«Desviación documentada»), porque con ~1,8–2,1 s reales el margen de 2 s resultó flaky.
  La protección efectiva contra un cuelgue es el corte externo `perl -e 'alarm shift; exec @ARGV' 120`: el
  bucle bloquea el hilo de JS, así que el `timeout` de Vitest no llega a dispararse.
- Sin `useSessionAttention.spec.tsx` ampliado, FR-006 no queda cubierto: es el único spec existente del dominio
  Chat que esta feature modifica.
