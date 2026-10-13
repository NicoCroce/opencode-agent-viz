# Quickstart — validación del refactor

**Feature**: `012-refactor-workspace-enrichment` | **Date**: 2026-10-13

Guía ejecutable para probar que el refactor **no cambia nada observable**. Detalles de entidades y firmas:
[data-model.md](./data-model.md) y [contracts/](./contracts/). No incluye código de implementación (eso es `tasks.md`).

## Prerrequisitos

- Rama `012-refactor-workspace-enrichment` con el árbol de trabajo del refactor.
- Node + pnpm instalados; dependencias al día (`pnpm install`).
- No se requiere servidor de OpenCode: todas las suites del alcance usan caché simulada y fixtures.

## 0. Línea base (antes de tocar código)

Objetivo: fijar el verde de partida de las cuatro suites protegidas.

```bash
pnpm test -- WorkspacePage.spec
pnpm test -- WorkspacePage.perf.spec
pnpm test -- useGraphEnrichment.spec
pnpm test -- useGraphEnrichment.freshness.spec
```

**Esperado**: 4 suites verdes. Guardar el conteo de tests como referencia (SC-001).

## 1. Compuertas de calidad (tras el refactor)

```bash
pnpm tsc        # TypeScript de la app
pnpm tsc:node   # vite.config.ts y configuración (no cubierto por el anterior)
pnpm lint       # ESLint strict
pnpm test       # Vitest completo
```

**Esperado**: 0 errores y **sin advertencias nuevas** (FR-022/SC-004).

## 2. No-regresión de las suites protegidas (el corazón de la feature)

```bash
git diff --name-only -- src/Infrastructure/specs src/Domains/Graph/Hooks/specs
pnpm test -- WorkspacePage
pnpm test -- useGraphEnrichment
```

**Esperado**: el primer comando **no imprime nada** (ningún spec existente editado) y ambas suites pasan
sin cambios de aserciones (FR-021/SC-001).

Escenarios que esas suites ya cubren y que deben seguir verdes:

- `Escape`: foco en el chat ⇒ no propaga; fuera ⇒ cierra fullscreen y luego limpia selección.
- Semilla de selección del chat desde el nodo abierto; sin sesión no hay chat.
- Badge de atención por raíz con el mismo conteo; realce por nodo derivado de la atención.
- Estados de pantalla error → carga → vacío → datos; tick del resumen solo con nodos activos.
- `useGraphEnrichment`: `pending → ready` por lotes; reinicio del plan al cambiar de sesión;
  frescura ≤1 s y "lo vivo gana sobre la siembra".

## 3. Piezas puras nuevas (una por regla)

```bash
pnpm test -- countAttentionByRoot
pnpm test -- toPendingQuestionEntry
pnpm test -- isFocusWithinChat
pnpm test -- readyNodeIds
pnpm test -- agentLatencyMedians
pnpm test -- mergeEnrichedNodes
```

**Esperado**: cada suite verde con casos de borde (FR-020/SC-003):

| Pieza | Caso obligatorio |
|---|---|
| `collectReadyIds` | id cacheado no se repite; `enriched` se une; **no** se abre consulta |
| `deriveAgentMedians` | mediana por agente; agente sin muestras ⇒ `null`; `totalMs` nulos ignorados |
| `mergeEnrichedNodes` | nodo no-ready conserva referencia; ready cambia `data`; entrada no mutada |
| `countAttentionByRoot` | raíz abierta suma el subárbol; otras raíces solo su sesión; +preguntas en la abierta |
| `toPendingQuestionEntry` | `state: 'pending'`, `answer: null`, opciones solo en `string`/`multiselect` |
| `isFocusWithinChat` | `activeElement` dentro de `[data-testid="chat-panel"]` ⇒ `true`; fuera/`null` ⇒ `false` |

## 4. Hooks y componente extraídos

```bash
pnpm test -- useChatPending
pnpm test -- useAttentionNodeIds
pnpm test -- useAttentionByRoot
pnpm test -- useChatSelectionSeed
pnpm test -- useWorkspaceEscape
pnpm test -- useHistoryData
pnpm test -- WorkspaceView
```

**Esperado**: verde; cada hook se prueba con `renderWithProviders` y entradas explícitas, sin depender del
ciclo de vida completo de la vista.

## 5. Alcance de archivos (SC-005)

```bash
git status --short
git diff --name-only main...HEAD
```

**Esperado**: solo aparecen los dos archivos objetivo, los vecinos nuevos
(`Infrastructure/{lib,Hooks,Components}` y `Graph/lib` con sus `specs/`), `WorkspacePage.constants.ts` si
hiciera falta, y `specs/012-refactor-workspace-enrichment/**`. Ningún otro archivo del plan priorizado
(`docs/internal/proposals/consolidacion/plan-priorizado.md` queda intacto).

## 6. Criterio de cierre

Verde en §1–§4, vacío en §2 (diff de specs) y alcance limpio en §5 ⇒ la feature cumple SC-001…SC-006.
