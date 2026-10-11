# Contrato — Atención de pendientes

**Feature**: `009-interactive-chat`
**Cubre**: FR-007, FR-009, FR-010, FR-011 · SC-005
**Implementa**: `Domains/Chat/lib/deriveAttention.ts` (**nuevo**),
`Domains/Chat/Hooks/useSessionAttention.ts`, `Domains/Chat/Hooks/useAttentionNotifications.ts`,
`Application/Components/Molecules/ChatAttentionBanner.tsx`,
`Domains/Sessions/Components/SessionCard.tsx` (badge),
`Domains/Graph/Components/NodeFocusContext.tsx` (realce por contexto).

---

## 1. Derivación (pura) — única fuente

```ts
// Domains/Chat/lib/deriveAttention.ts
deriveAttention(
  graph: TGraphModel,
  permissions: PermissionRequest[], // de permissions.list() (caché global reducida)
): TAttentionItem[]
```

`TAttentionItem` = `{ id, kind: 'permission' | 'question', sessionId, nodeId: string | null, title, at }`.

- Recorre los nodos del subárbol con `status === 'waiting-permission' | 'waiting-input'`.
- Cruza con `permissions.list()` (que incluye permisos de **sesiones hijas**, porque el evento trae `sessionID`) para el detalle `action`/`resources[]`.
- `title` = acción del permiso o título de la pregunta; `nodeId` = nodo afectado si está en el subárbol.
- Salida ordenada por `at`. Sin pendientes → `[]`.

## 2. Las cinco señales (FR-009)

| Señal | Dónde | Regla |
|-------|-------|-------|
| Badge en sesión (raíz) | `SessionCard` | visible si el subárbol de esa raíz tiene ≥1 `TAttentionItem`; `aria-label` textual (no solo color). |
| Badge en pestaña Chat | `ui/tabs` / tab móvil | token ≥3:1 **más** marca no-color. |
| Banner | `ChatAttentionBanner` (`Alert`) en el panel | resumen del pendiente + acción a la request. |
| Aviso efímero | `sonner` toast (live region) | solo ante un pendiente **nuevo**; `useAttentionNotifications` deduplica por `id`. |
| Realce de nodo | grafo | **solo** el nodo afectado; fluye por `NodeFocusContext`, **no** por `data`. |

- Orden recomendado (evitar saturación): badge + banner + toast, y realce **solo** en el nodo afectado.
- El realce por contexto preserva la identidad de render y **no** re-layouta (Principio VII).

## 3. Navegación a la request (FR-010)

- La acción de cualquier señal (badge/banner/toast) **navega/enfoca la request origen**: selecciona la sesión/nodo de origen (aunque sea una hija) y abre la pestaña Chat.
- El `sessionId` de origen es el que aparece en `TAttentionItem`.

## 4. Limpieza (FR-011)

- Al resolverse el pendiente (respuesta propia, TUI u otra pestaña), deja de aparecer en `deriveAttention` → **todas** las señales desaparecen.
- Tras responder, la mutation invalida las claves relevantes (ver `write-facade-contract §6`).

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| A1 | Nodo `waiting-permission` con permiso en `permissions.list()` → 1 ítem `permission` | spec puro `deriveAttention.spec.ts` |
| A2 | Pendiente de una sesión hija aparece con su `sessionId` de origen | spec puro |
| A3 | Sin pendientes → `[]` | spec puro |
| A4 | Badge/banner/toast se montan al aparecer un ítem y desaparecen al resolverse | specs de componentes |
| A5 | Toast solo ante pendiente nuevo (dedupe por `id`) | spec de `useAttentionNotifications` |
| A6 | El realce marca **solo** el nodo afectado y no re-layouta | spec del grafo (contexto) |
| A7 | Actuar sobre una señal enfoca la request origen y abre el chat | spec de `WorkspacePage`/`ChatPanel` |
