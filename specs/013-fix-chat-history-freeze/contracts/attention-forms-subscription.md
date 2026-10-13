# Contract — Suscripción de formularios cacheados (`useCachedForms`)

**Feature**: `013-fix-chat-history-freeze` | **Date**: 2026-10-13 | **Plan**: [plan.md](../plan.md)

Interfaz **interna** del dominio Chat (no hay API/CLI/servicio externo). El
contrato fija las invariantes que el enriquecimiento de preguntas de
`useSessionAttention` debe cumplir para no congelar el histórico. Es el contrato
observable por el resto del dominio y por el arnés de integración.

## §1 Superficie (sin cambios)

```ts
// src/Domains/Chat/Hooks/useSessionAttention.ts (firma pública congelada)
useSessionAttention(rootId: string | null, graph: TGraphModel): TAttentionItem[]
```

- Se mantiene la firma, el nombre y el fichero (FR-007).
- Prohibido alterar `queryKeys.ts`, `Inspector.service.ts`, barrels, UI, copy ni
  `data-testid` (superficie congelada de 012).

## §2 Invariante de filtro por clave (R1)

- La suscripción a `QueryCache` reacciona **solo** a la clave exacta
  `queryKeys.sessions.forms(id)` = `['sessions','forms',id]`, con `id` en el
  conjunto de sesiones con pregunta pendiente.
- **MUST NOT** reaccionar a `queryKeys.sessions.questions(id)` =
  `['sessions','forms',id,'questions']`. El anidamiento bajo `forms(id)` es
  intencional (invalidación por prefijo), pero la suscripción a formularios crudos
  no hereda ese prefijo.

## §3 Invariante de identidad del índice (R2, Principio VII)

- `useSessionAttention` devuelve `TAttentionItem[]` **estable** salvo cambio real
  del dato: si ninguna lista `FormInfo[]` cambió, el índice interno es la misma
  referencia y ningún `setState` provoca render.
- **MUST NOT** construir un `Record<string, FormInfo[]>` nuevo cuando el contenido
  no cambió.

## §4 Invariante de eventos (R3)

- **MUST** reaccionar solo a eventos portadores de dato (`type === 'updated'`).
- **MUST NOT** tratarse como cambio de dato los eventos estructurales
  (`observerOptionsUpdated`, `observerResultsUpdated`, `observer*`).

## §5 Invariantes de comportamiento observable (FR-003/FR-004/FR-005)

- El ítem `kind: 'question'` conserva `id`/`title` del `FormInfo` cacheado de
  `sessions.forms(id)` cuando existe; sin formulario, mantiene el respaldo
  (`id` = `question:<sessionId>`, `title` = título del nodo). Sin diferencias de
  texto/etiqueta/posición respecto de hoy.
- Las preguntas de sesiones **hijas** que alimentan los badges siguen
  enriqueciéndose igual (se acotan por el subárbol de `rootId`, como hoy).
- Otras sesiones, permisos pendientes y conteos/etiquetas de badges: idénticos.

## §6 Invariante de terminación (FR-001/FR-002)

- Abrir el histórico de una sesión `waiting-input` **MUST** converger: el clic
  termina, el overlay monta y la interfaz responde (sin bucle de render).
- No existe camino de notificación que re-dispare el efecto de suscripción tras
  un `sync()` (las dependencias `[queryClient, serialized, read]` no cambian por
  un render derivado del propio estado).

## §7 Contrato de regresión (FR-006)

- **Unitaria** (`src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx`):
  montar el hook + un observador real sobre `sessions.questions(id)`, escribir
  `sessions.forms(id)` y afirmar convergencia y enriquecimiento; `timeout` corto.
  Caso negativo (Principio VIII): notificación sin cambio de dato ⇒ identidad
  estable del índice (sin nuevo estado).
- **Integración**
  (`src/Infrastructure/specs/integration/workspaceHistoryWaitingInput.integration.spec.tsx`):
  sembrar nodo `waiting-input`, `fireEvent.click('Abrir histórico')`, y afirmar
  `data-node` = sesión y `data-question-count >= 1`; `timeout` corto.
- **Desviación D1 (aplicada)**: en los tres specs E2E de regresión el `timeout` se
  subió a `15_000`, no `2_000`: con ~1,8–2,1 s reales por test el margen de 2 s
  resultó flaky. El `timeout` de Vitest **no** protege contra el cuelgue (bloquea
  el hilo de JS); la protección efectiva es el corte externo
  `perl -e 'alarm shift; exec @ARGV' 120`. Ver `baseline.md` §«Desviación documentada».
- Ambas pruebas **MUST** fallar sobre el estado previo (hoy cuelgan/no terminan) y
  pasar tras la corrección.
