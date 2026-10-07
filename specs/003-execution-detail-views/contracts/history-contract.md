# Contract — Histórico (`Domains/History/`)

Cubre US1 (lectura de respuestas/razonamiento en el timeline) y US2 (vista dedicada). `buildHistory` es pura y sin React (Constitución V).

## `buildHistory()` — `lib/buildHistory.ts`

```ts
function buildHistory(messages: TSessionMessage[]): THistoryEntry[];
```

- Aplana los mensajes normalizados en `THistoryEntry[]` (unión discriminada por `kind`, ver [data-model.md](../data-model.md) §2.3).
- Orden: por `info.time.created`; dentro de un assistant, por el orden de `content`.
- `id` estable = `info.id` (+ ordinal de la parte para `answer`/`reasoning`/`tool`).
- `isComplete` de `answer`/`reasoning` = el assistant tiene `time.completed` (FR-006).
- No incluye descendientes, no muta la entrada y no depende de runtime del SDK (solo de tipos).

Reglas:
- **FR-003**: cada tipo (usuario, respuesta, razonamiento, herramienta) tiene su `kind` y se respeta el orden de producción.
- **FR-004/011**: el `tool` lleva `TToolEntry` con `input`, `result`, `error` y duración; se expande/contrae en la UI.
- **FR-007**: los adjuntos del usuario se listan por nombre; sin nombre → "sin nombre".
- **FR-009**: cubre mensajes, respuestas, razonamiento, herramientas, cambios de agente/modelo/ubicación, avisos de sistema, sintéticas/skill y compactación.
- **FR-035**: `compaction` marca `running | completed | failed` en su posición cronológica.
- Un assistant sin `time.completed` produce entradas `isComplete: false` (en curso) y no presenta texto parcial como completo (FR-006).

## `useHistoryPagination()` — `Hooks/useHistoryPagination.ts`

```ts
function useHistoryPagination(sessionId: string | null): {
  entries: THistoryEntry[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
};
```

- `useInfiniteQuery` sobre `queryKeys.sessions.history(sessionId)` con `getHistoryMessages`.
- `initialPageParam = undefined`; `getNextPageParam = (last) => last.nextCursor ?? undefined`.
- Páginas en orden `desc` (más reciente primero); `entries` las invierte y aplana a orden ascendente.
- **FR-013**: sin tope fijo; se sigue mientras `hasNextPage`.
- **FR-016**: `isFetchNextPageError` → aviso explícito ("puede faltar contenido"); un fin normal no avisa.
- **Fluidez (SC-011)**: las filas usan `content-visibility: auto` + `contain-intrinsic-size`.

## `useHistory()` — `Hooks/useHistory.ts`

```ts
function useHistory(): {
  targetId: string | null;
  open: (sessionId: string) => void;
  close: () => void;
  navigateTo: (sessionId: string) => void;   // linaje, sin cerrar
};
```

- `targetId` vive en `WorkspacePage` (Infrastructure) para preservar la selección/modo cadena al cerrar (FR-014).
- `open` desde el detalle del agente y desde doble clic en el nodo (FR-008, SC-003).
- `navigateTo` cambia el objetivo sin cerrar el overlay (FR-012, SC-004).
- Al cambiar la sesión raíz, `close()`. Si el objetivo desaparece del grafo, el overlay se marca "no disponible" y se cierra (edge case).

## `HistoryModal` — contrato de presentación

```ts
interface HistoryModalProps {
  node: TGraphNode;              // identidad/estado/métricas para la cabecera
  lineage: TLineageNav;          // padre e hijos (FR-012)
  showReasoning: boolean;        // toggle compartido (FR-002)
  onToggleReasoning: () => void;
  onNavigate: (sessionId: string) => void;
  onClose: () => void;
}
```

- Overlay a pantalla completa (superficie `--surface-1`), cabecera fija + timeline scrollable. En móvil ocupa toda la pantalla (FR-040).
- **Cabecera (FR-010)**: título/nombre, modelo, estado, coste, tokens, resultado final y directorio; dato ausente → "no disponible" (FR-038). Incluye navegación "Invocado por" / "Invocó a".
- **Estados de pantalla (FR-015)**: `isError` → `<EmptyScreenError />`; `isLoading` → skeleton; sin actividad → `<EmptyState />` ("Sin actividad registrada", acceptance 6); datos → timeline.
- `HistoryTimeline` monta un centinela superior (`IntersectionObserver`) que dispara `fetchNextPage`.
- `ToolCallEntry` expande/contrae input/resultado/error (FR-011) y muestra el estado real sin inventar resultado (edge case).
