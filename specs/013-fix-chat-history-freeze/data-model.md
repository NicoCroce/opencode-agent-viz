# Phase 1 — Data Model: Histórico de sesiones en espera de respuesta sin congelar la interfaz

**Feature**: `013-fix-chat-history-freeze` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

No se introducen entidades nuevas ni cambios de forma de datos. El modelo
describe las piezas **ya existentes** que intervienen en el defecto y las
invariantes de identidad que el arreglo debe garantizar.

## 1. Entidades existentes (sin cambios de forma)

| Entidad | Origen | Campos relevantes | Notas |
|---|---|---|---|
| `FormInfo` | `@opencode/client` (SDK) | `id`, `sessionID`, `title`, `fields[]` | Tipo del SDK; **prohibido** redefinirlo (Principio IV) |
| `TAttentionItem` | `src/Domains/Chat/Chat.entity.ts` | `id`, `kind: 'permission'\|'question'`, `sessionId`, `nodeId`, `title`, `at` | Ítem de atención; el de `kind: 'question'` se enriquece |
| `Record<string, FormInfo[]>` | índice derivado en `useSessionAttention` | clave = `sessionId`, valor = formularios crudos cacheados | **Sin persistencia**; vive en estado local del hook |
| `TGraphModel` (`subtree`) | `src/Domains/Graph/Graph.entity.ts` | `nodes`, `edges` | Entrada de `deriveAttention`; no cambia |

## 2. Claves de caché (relación crítica)

| Clave | Valor | Longitud | Consumidor |
|---|---|---|---|
| `queryKeys.sessions.forms(id)` | `['sessions','forms',id]` | 3 | `useCachedForms` (atención), grafo (`enrichNodeData`) |
| `queryKeys.sessions.questions(id)` | `['sessions','forms',id,'questions']` | 4 | `useSessionForms` (Inspector), `useChatController`, histórico |

**Relación trampa (documentada en `src/Domains/queryKeys.ts:42-48`)**: `questions(id)`
se **anida a propósito** bajo `forms(id)` para que la invalidación por prefijo de
`forms(id)` (eventos `form.*`) alcance también a las preguntas.

**Invariante de suscripción (R1)**: el índice de formularios crudos solo reacciona
a la clave de **longitud 3** (`sessions.forms(id)`), nunca a la de longitud 4.

## 3. Evento de caché (`QueryCache.subscribe`)

Forma mínima consumida por el hook (tipado estructural, R3):

```text
{
  type?: string,                    // 'updated' = portador de dato; 'observer*' = estructural
  query: { queryKey: readonly unknown[] }
}
```

**Invariante de evento (R3)**: solo `type === 'updated'` dispara `sync()`.
Los eventos `observerOptionsUpdated` / `observerResultsUpdated` / `observer*`
**no** son cambios de dato y se ignoran.

## 4. Invariantes de identidad (R2 — Principio VII)

1. El índice `Record<string, FormInfo[]>` devuelto por `read()` es **referencialmente
   estable**: si todas las listas `FormInfo[]` por sesión son las mismas que en la
   lectura previa, se devuelve la **referencia anterior** (no un objeto nuevo).
2. Consecuencia observable: una notificación de caché que no cambia el dato **no**
   produce un nuevo valor de estado ⇒ React no re-renderiza (`Object.is`).
3. La identidad cambia **solo** cuando cambia al menos una lista de formularios de
   las sesiones con pregunta pendiente.

## 5. Transiciones de estado

```text
[montaje]
  efecto → sync() → índice inicial (referencia R0)
  suscribe a QueryCache

[notificación de caché]
  ¿key exacta forms(id) ∧ id ∈ ids ∧ type === 'updated'?
      no  → no-op (R1/R3)
      sí  → read()
              ¿alguna FormInfo[] cambió de referencia?
                  no → devuelve índice previo → setForms(prev) → SIN render (R2)
                  sí → índice nuevo → setForms(nuevo) → render acotado
                       → enriquecimiento de ítems kind:'question' (id/title del FormInfo)
                       → FIN (no re-dispara el efecto: ids/read sin cambio)

[escritura de forms(id) mientras el histórico está abierto]
  → índice nuevo (uno) → badge/histórico reflejan el estado nuevo → sin bucle
```

**Invariante de terminación (FR-001/FR-002)**: ningún ciclo de notificación
produce render, porque (a) el prefijo ya no casa `questions(id)`, (b) los eventos
estructurales no disparan nada y (c) un dato sin cambio devuelve el índice previo.

## 6. Reglas de validación (derivadas de las FR)

| Regla | FR | Comprobación |
|---|---|---|
| Abrir el histórico de `waiting-input` termina y devuelve el control | FR-001 | Prueba de integración con `timeout` acotado (D1: `15_000` + corte externo `perl alarm`) |
| No hay bucle sin progreso al proyectar el histórico | FR-002 | Prueba unitaria acotada + caso de identidad estable |
| El ítem de pregunta conserva `id`/`title` del `FormInfo` cacheado | FR-003 | `useSessionAttention.spec` existente (enriquecimiento) + regresión |
| Otras sesiones y badges no cambian | FR-004/FR-005 | Batería existente verde |
| La corrección está cubierta por una prueba que hoy no termina | FR-006 | Specs nuevas rojas hoy / verdes tras el fix |
| Sin cambios de UI/copy/superficie | FR-007 | Solo se toca el fichero del hook + specs |

## 7. Fuera de alcance del modelo

No hay claves nuevas, ni estados de servidor, ni persistencia, ni migraciones.
No se modifica la forma de `TAttentionItem`, `FormInfo` ni `TGraphModel`.
