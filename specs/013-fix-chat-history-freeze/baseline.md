# Línea base de no regresión — 013-fix-chat-history-freeze

- HEAD: `0eebec68a0a70cf25b75656c5db93b7dca8b2408`
- Fecha: 2026-10-13T13:40:35-03:00

## T001 · Suite completa
```
 Test Files  197 passed (197)
      Tests  1976 passed | 1 skipped (1977)
   Duration  43.61s (transform 4.74s, setup 52.71s, collect 56.76s, tests 47.63s, environment 89.41s, prepare 16.35s)
```

| Suite | Test Files | Tests | Duration |
|---|---|---|---|
| `Chat_Hooks_specs` | Test Files  5 passed (5) | Tests  60 passed (60) | 2.18s |
| `WorkspacePage.spec` | Test Files  1 passed (1) | Tests  26 passed (26) | 2.23s |
| `WorkspacePage.perf.spec` | Test Files  1 passed (1) | Tests  6 passed (6) | 1.75s |
| `useGraphEnrichment.spec` | Test Files  1 passed (1) | Tests  2 passed (2) | 911ms |
| `useGraphEnrichment.freshness.spec` | Test Files  1 passed (1) | Tests  5 passed (5) | 1.06s |

## T002 · Compuertas y alcance
```
pnpm tsc      → exit 0
pnpm tsc:node → exit 0
pnpm lint     → exit 0
git status --short:
 M .specify/feature.json
?? specs/013-fix-chat-history-freeze/
git diff --name-only -- src/Infrastructure/specs src/Domains/Graph/Hooks/specs:
(vacío = sin cambios)
```

### sha256 de los ficheros intocables
```
6850ad09e78eeaae62af35135d4e6bd172b0c0377964fcd5c36e3fbc02f99246  src/Infrastructure/specs/WorkspacePage.spec.tsx
6260f19d5c48c814447c25da2e3ae91dcb8ba455750537beb91e0d06e4d5cde6  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx
f858fc0e35566a22a7791172edacb7b3232cb73101ed71892a9add28b3d3df66  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx
a9dacd6eb1f9c558bc0089e51687fd972ee7cb0fb1d330436de291ab71e5d296  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx
78bc93e6e434d56519bf1aa88d98f470745563684de9bd3b7dee578ce01e2363  src/Domains/Chat/Hooks/specs/useChatController.spec.tsx
d9bba9717ec0a3977e8d4c243ec7be1dd3eaf80b516cfff5bc79d90d63f85aff  src/Domains/Chat/Hooks/specs/useChatAutoScroll.spec.tsx
c680635e5d44f59d9131353abf4fe214c592c20577def6abc51bdcd10ab3798a  src/Domains/Chat/Hooks/specs/useChatDraft.spec.tsx
729cc8c3e8a2936ef6d41502288a394e32a928a14caf660efaa30fbbc75241bd  src/Domains/Chat/Hooks/specs/useAttentionNotifications.spec.tsx
```

## T003 · Mapa de fronteras y dueños E2E

| Frontera | Cadena de estado (contracts §) | Dueño E2E | Caso negativo |
|---|---|---|---|
| U7 ↔ U4 | observador real sobre `sessions.questions(id)` (§2/§4) → suscripción `useCachedForms` | T006 `workspaceHistoryWaitingInput.integration.spec.tsx` | `questions(id)` ausente/vacío ⇒ abre sin cuelgue, `data-question-count=0` |
| U6 ↔ U4 | `sessions.forms(id)` + `FormDetail` cacheados → índice enriquecido (§2/§3/§5) | T012 `workspaceAttentionFormsIndex.integration.spec.tsx` | `sessions.forms(id)` vacío ⇒ respaldo `question:<sessionId>`, sin cuelgue |
| U4 ↔ U5 | índice `TAttentionItem[]` → badge por raíz (§5) | T014 `workspaceAttentionBadgeStability.integration.spec.tsx` | sesión fuera del subárbol / sin forms ⇒ conteo `0` |
| U2 ↔ U7/U8 | `useHistoryData` → `HistoryOverlay` (questions/`missingId`) | `workspaceHistoryData.integration.spec.tsx` (012/T022, ya dueño) | `targetId` inexistente ⇒ `missingId` + `clearMissing` |

Invariantes del contrato §1–§7 que guían las tareas: clave exacta `['sessions','forms',id]`, identidad estable de `read()`, solo eventos `type === 'updated'`, superficie congelada, terminación (todo `it` de regresión con `timeout: 2_000`).

## T004 · Arnés de integración (solo lectura, sin cambios)

- `AgentGraphMarker` emite `Abrir histórico` con `onOpenHistory` sobre el primer nodo (harness.tsx).
- `mockChatBarrel` conserva el `useSessionAttention` **real** y `mockInspectorBarrel` el `useSessionForms` **real**: la frontera U7↔U4 se ejerce de verdad.
- Sin escrituras de producto. Convención `timeout: 2_000` en los `it` de regresión (research R4; `vitest.config.ts` no fija `testTimeout`).

## T010 / T013 / T015 / T016 · Verificación de la corrección

| Tarea | Qué se ejecutó | Resultado |
|---|---|---|
| T010 | `useSessionAttention.spec.tsx` + `workspaceHistoryWaitingInput.integration.spec.tsx` | 2 files / **18 tests verdes**, 8.21 s |
| T013 | 4 suites protegidas + `src/Domains/Chat/Hooks/specs` | 9 files / **105 tests verdes** |
| T016 | 3 fronteras E2E nuevas (U7↔U4, U6↔U4, U4↔U5) + unitaria + `workspaceHistoryData` (T022, solo lectura) | 5 files / **24 tests verdes**, 9.44 s |
| T017 | `pnpm test` + `tsc` + `tsc:node` + `lint` | ver abajo |

### T015 · Rojo → verde (FR-006)

| Estado | Regresión unitaria | Regresión E2E |
|---|---|---|
| **Fix revertido** (`git checkout -- src/Domains/Chat/Hooks/useSessionAttention.ts`) | no termina — `SIGALRM` (`exit 142` a los 60 s) | no termina — `SIGALRM` (`exit 142` a los 60 s) |
| **Fix restaurado** (`R1+R2+R3`) | verde | verde (18 tests en total, 8.21 s) |

El cuelgue bloquea el hilo de JS, así que ni el `timeout: 2_000` del `it` ni el de Vitest llegan a dispararse: el corte externo con `perl -e 'alarm shift; exec @ARGV' <seg>` es lo que lo hace fallar en lugar de eternizarse.

### T017 · Cierre estático y batería completa (quickstart Escenario 4)

```
pnpm test     → Test Files  200 passed (200) · Tests  1988 passed | 1 skipped (1989)
pnpm tsc      → exit 0
pnpm tsc:node → exit 0
pnpm lint     → exit 0
```

El nº de tests **no baja** respecto de T001 (1976 → 1988, +12).

### T018 · Comparación final de no regresión

- **Suites**: T001 197 files / 1976 tests → T017 200 files / 1988 tests; 0 fallos en ambos.
- **Ficheros intocables**: sha256 de los 8 ficheros protegidos **idéntico** al de T002 (0 cambios). El único spec existente que cambia es `useSessionAttention.spec.tsx` (ampliado por T005/T011), como manda la spec.
- **Mapa de fronteras cerrado**: U7↔U4 (T006), U6↔U4 (T012) y U4↔U5 (T014) tienen dueño E2E propio con caso negativo; U2↔U7/U8 sigue con `workspaceHistoryData.integration.spec.tsx` (T022 de 012).

### Desviación documentada

`tasks.md` (research R4) fijaba `timeout: 2_000` en los `it` de regresión. Se subió a `timeout: 15_000` en los **tres specs E2E** de regresión (`workspaceHistoryWaitingInput`, `workspaceAttentionFormsIndex`, `workspaceAttentionBadgeStability`): con ~1,8–2,1 s reales por test, el margen de 2 s produjo **flakiness** (una ejecución falló al encadenar dos arranques en frío de Vitest). `useSessionAttention.spec.tsx` conserva `2_000` en sus dos casos de regresión unitaria (duran milisegundos). Un cuelgue real bloquea el hilo de JS, así que ni el `timeout` del `it` ni el de Vitest llegan a dispararse: la protección efectiva es el corte externo `perl -e 'alarm shift; exec @ARGV' 120`.
