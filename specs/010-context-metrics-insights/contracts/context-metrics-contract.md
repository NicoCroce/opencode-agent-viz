# Contrato — Métricas de contexto (composición, ventana, aporte al padre)

**Feature**: `010-context-metrics-insights`
**Cubre**: FR-001..FR-005, FR-011..FR-014, FR-015..FR-017 · SC-001, SC-002, SC-004, SC-005, SC-007
**Implementa**: `Domains/Graph/lib/metrics/contextBreakdown.ts`, `Domains/Graph/lib/metrics/windowStats.ts`,
`Domains/Graph/lib/metrics/contextGrowth.ts`, `Domains/Graph/lib/metrics/parentImpact.ts`,
`Domains/Graph/Graph.entity.ts` (`TNodeContextMetrics`, `context?`),
`Domains/Graph/lib/enrichNodeData.ts`, `Domains/Graph/lib/reconcile/comparators.ts` (`sameContext`).

---

## 1. Composición del contexto (FR-001..FR-005)

```ts
// Domains/Graph/lib/metrics/contextBreakdown.ts (puro)
export type TContextCategory =
  | 'toolResult' | 'toolInput' | 'reasoning' | 'assistantText' | 'userText';

export interface TContextBucket {
  category: TContextCategory;
  chars: number;
  tokens: number | null;   // null si no hay ventana medible
  pct: number;             // 0..100
}

export interface TContextBreakdown {
  buckets: TContextBucket[]; // ordenados por chars descendente
  chars: number;
  windowTokens: number | null;
  hasTokens: boolean;
}

export const deriveContextBreakdown = (
  messages: TSessionMessage[],
): TContextBreakdown;
```

### Invariantes
- **FR-002 / SC-002**: `Σ buckets.pct ≈ 100` (±1). `pct` se calcula por proporción de caracteres; con `chars = 0` → `buckets = []` y estado vacío.
- **FR-003**: `tokens_bucket = round(windowTokens × chars_bucket / chars)`. `windowTokens` = `input + cache.read + cache.write` del **último** mensaje assistant con `tokens` (R1), **no** el acumulado del nodo.
- **FR-004**: `buckets` ordenados por `chars` descendente; cada bucket expone `chars` y `tokens` (absoluto) además de `pct`.
- **FR-005**: si `windowTokens === null`, `hasTokens = false` y todos los `tokens` son `null`; la UI muestra solo el peso relativo o "no disponible".

### Categorización (edge cases)
- Parte `tool` en `streaming`: su `state.input` es texto parcial → suma a `toolInput` por `len(input)`.
- Parte `tool` en `running`/`completed`/`error`: `toolInput` por `JSON.stringify(state.input)`; `toolResult` por `Σ len(text)` de `state.content` (solo `text`, se ignora `file`).
- Mensajes no-assistant/no-user (system, shell, compaction, etc.): no aportan caracteres a las categorías.

---

## 2. Ventana y caché (FR-016)

```ts
// Domains/Graph/lib/metrics/windowStats.ts (puro)
export interface TContextWindow {
  windowTokens: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  hitRate: number | null;      // cacheRead / (cacheRead + input)
  costPerKToken: number | null;
}

export const deriveContextWindow = (
  metrics: TNodeMetrics,
  windowTokens: number | null,
): TContextWindow;
```

### Invariantes
- `hitRate = cacheRead / (cacheRead + input)` con el **acumulado** del nodo; `null` si `cacheRead + input` es 0 o falta.
- `costPerKToken = cost / (windowTokens / 1000)`; `null` sin `windowTokens` o sin `cost`.

## 2bis. Evolución y compactaciones (FR-016)

```ts
// Domains/Graph/lib/metrics/contextGrowth.ts (puro)
export interface TContextGrowthPoint { stepId: string; startedAt: number; windowTokens: number; }
export type TContextCompactionStatus = 'running' | 'completed' | 'failed';
export type TContextCompactionReason = 'auto' | 'manual';
export interface TContextCompaction { id: string; at: number; status: TContextCompactionStatus; reason: TContextCompactionReason; }
export interface TCompactionEffect { before: number | null; after: number | null; }

export const deriveContextGrowth = (messages: TSessionMessage[]): TContextGrowthPoint[];
export const deriveContextCompactions = (messages: TSessionMessage[]): TContextCompaction[];
export const deriveCompactionEffect = (
  growth: TContextGrowthPoint[],
  compaction: TContextCompaction,
): TCompactionEffect;
```

### Invariantes
- **`deriveContextGrowth`**: un punto por mensaje `assistant` con `tokens`; `windowTokens = input + cache.read + cache.write` (misma definición que §1, R1). Ordenado por `time.created` ascendente. Los pasos sin `tokens` se omiten.
- **`deriveContextCompactions`**: un episodio por `SessionMessageCompaction`, con su `status` y `reason` **reales** (SC-007). Ordenado por `time.created` ascendente.
- **`deriveCompactionEffect`**: `before` = ventana del último paso medido con `startedAt <= compaction.at`; `after` = ventana del primer paso con `startedAt > compaction.at`. Sin pasos a un lado, el extremo es `null` (no se inventa el efecto).
- El efecto se calcula **bajo demanda** en `useContextMetrics` (hook del Inspector), no en el modelo del grafo (R5).

---

## 3. Aporte al contexto del padre (FR-012..FR-014)

```ts
// Domains/Graph/lib/metrics/parentImpact.ts (puro)
export interface TParentImpact {
  parentId: string;
  addedChars: number;
  addedTokens: number | null;
  pctOfParent: number | null;
}

export const deriveParentImpact = (
  parentId: string,
  parentMessages: TSessionMessage[],
  childSessionId: string,
): TParentImpact | null;
```

### Reglas
- Localiza el tool part de spawn: `name ∈ {'subagent','task'}` y `state.metadata.sessionID === childSessionId` (mismo vínculo que `deriveTasks`). `parentId` llega por parámetro porque los mensajes del SDK no exponen la sesión a la que pertenecen.
- `addedChars` = `Σ len(text)` de `state.content` de ese tool.
- `pctOfParent = addedChars / charsTotalesDelPadre × 100`, donde `charsTotalesDelPadre = deriveContextBreakdown(parentMessages).chars`.
- `addedTokens = round(windowTokensDelPadre × pctOfParent / 100)`; `null` sin ventana del padre.
- **FR-013**: devuelve `null` si el nodo es raíz, si el padre no tiene mensajes cargados o si no se halla el tool de spawn → UI "sin padre / no disponible".
- **FR-014**: la UI ofrece navegación al padre (`parentId`) mediante un control operable por teclado.
- Se calcula **bajo demanda** en el hook del Inspector, no en el modelo del grafo (R5).

---

## 4. Agregado por nodo (FR-015, FR-017)

```ts
// Domains/Graph/Graph.entity.ts
export interface TNodeContextMetrics {
  breakdown: TContextBreakdown;
  window: TContextWindow;
  growth?: TContextGrowthPoint[];      // §2bis; opcional (US4 la añade)
  compactions?: TContextCompaction[];  // §2bis; opcional (US4 la añade)
  latency?: TLatencyReport | null;     // ver latency-anomaly-contract; opcional (US5 la añade)
  provisional: boolean;
}
// campo nuevo, opcional (patrón effort?):
context?: TNodeContextMetrics | null;
```

- Se puebla en `enrichNodeData` (R3), memoizable por identidad de `messages`.
- `provisional = isActiveStatus(status)`.
- `growth`/`compactions` son opcionales: `undefined` y `[]` equivalen a "sin pasos"/"sin compactaciones".

## 5. Comparador (recon)

`sameContext(a, b)` compara `provisional`, `breakdown` (categoría/chars/tokens/pct de cada bucket y `windowTokens`), `window` (campos), `growth` (stepId/startedAt/windowTokens), `compactions` (id/at/status/reason) y `latency` (samples + anomalies). `sameNodeData` **debe** invocarlo. Sin él, `reconcileGraphModel` no reemplaza el nodo y el panel queda congelado.

## 6. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| C1 | Con categorías de tamaño conocido, los % coinciden con el reparto por caracteres y suman 100 | spec puro `contextBreakdown.spec.ts` |
| C2 | Los tokens por bucket suman `windowTokens` (± redondeo) | spec puro |
| C3 | Sin tokens, `hasTokens = false` y `tokens = null` en todos los buckets | spec puro |
| C4 | Sin mensajes, `chars = 0` y `buckets = []` (vacío, no ceros) | spec puro |
| C5 | `hitRate` correcto con y sin caché | spec puro `windowStats.spec.ts` |
| C6 | `deriveParentImpact` halla el tool por `metadata.sessionID` y calcula `pctOfParent` | spec puro `parentImpact.spec.ts` |
| C7 | Nodo raíz / sin tool de spawn → `null` | spec puro |
| C8 | `sameContext` detecta cambios y `sameNodeData` los propaga | spec `reconcileGraph.spec.ts` extendido |
| C9 | La sección de contexto muestra los 4 estados | spec de `ContextSection` |
| C10 | `deriveContextGrowth` deriva la ventana por paso, ordena y omite los pasos sin tokens | spec puro `contextGrowth.spec.ts` |
| C11 | `deriveContextCompactions` conserva `status`/`reason` reales y ordena por tiempo | spec puro `contextGrowth.spec.ts` |
| C12 | `deriveCompactionEffect` compara antes/después y deja `null` el extremo sin pasos | spec puro `contextGrowth.spec.ts` |
| C13 | `sameContext` detecta cambios de `growth`/`compactions` y trata `undefined` ≡ `[]` | spec `reconcileGraph.spec.ts` |
