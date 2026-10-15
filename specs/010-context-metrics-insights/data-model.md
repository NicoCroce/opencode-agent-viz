# Data Model — Context Composition, Parallel Speedup & Latency Insights

**Feature**: `010-context-metrics-insights`
**Date**: 2026-10-12
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

Entidades de **vista** que introduce la feature. **No hay entidades de servidor nuevas** (Principio I: observador). Los datos crudos siguen siendo tipos del SDK (`SessionMessageInfo`, `TokenUsageInfo`, `ModelRef`) y **no se redefinen** (Principio IV). Convención: prefijo `T` para tipos de vista (`AGENTS.md`, `Graph.entity.ts`).

Todos los tipos se declaran en `src/Domains/Graph/Graph.entity.ts` (el dominio que ya posee `TNodeMetrics`), salvo los del panel, que se apoyan en estos.

---

## 1. Composición del contexto (US1)

### 1.1 `TContextCategory`
Unión de categorías de contenido del contexto.

```
'toolResult' | 'toolInput' | 'reasoning' | 'assistantText' | 'userText'
```

| Categoría | Origen en los mensajes |
|---|---|
| `toolResult` | `Σ len(text)` de `state.content` de partes `tool` (`completed`/`error`) |
| `toolInput` | `len(JSON.stringify(state.input))` de partes `tool` no-streaming, más `len(state.input)` textual en `streaming` |
| `reasoning` | `Σ len(text)` de partes `reasoning` |
| `assistantText` | `Σ len(text)` de partes `text` |
| `userText` | `Σ len(info.text)` de `SessionMessageUser` |

### 1.2 `TContextBucket`
| Campo | Tipo | Regla |
|---|---|---|
| `category` | `TContextCategory` | — |
| `chars` | `number` | ≥ 0 |
| `tokens` | `number \| null` | `null` si no hay ventana medible |
| `pct` | `number` | `chars / charsTotales × 100`; suma 100% (±1) |

### 1.3 `TContextBreakdown`
| Campo | Tipo | Regla |
|---|---|---|
| `buckets` | `TContextBucket[]` | ordenados por `chars` **descendente** |
| `chars` | `number` | total de caracteres del contexto |
| `windowTokens` | `number \| null` | tokens del último paso (R1); `null` sin datos |
| `hasTokens` | `boolean` | `windowTokens !== null` |

**Invariantes**: `Σ buckets.pct ≈ 100`; sin `windowTokens`, todos los `tokens` son `null` y `hasTokens = false`; sin mensajes, `chars = 0` y `buckets = []` (estado vacío, nunca ceros que aparenten datos).

---

## 2. Ventana y caché (US4)

### 2.1 `TContextWindow`
| Campo | Tipo | Regla |
|---|---|---|
| `windowTokens` | `number \| null` | `input + cacheRead + cacheWrite` del último paso (R1) |
| `cacheRead` | `number \| null` | acumulado del nodo (`TTokenUsage.cacheRead`) |
| `cacheWrite` | `number \| null` | acumulado del nodo |
| `hitRate` | `number \| null` | `cacheRead / (cacheRead + input)` acumulado; `null` si el denominador es 0 |
| `costPerKToken` | `number \| null` | `cost / (windowTokens / 1000)`; `null` sin datos |

---

## 3. Métricas de contexto agregadas por nodo (US1+US4)

### 3.1 `TNodeContextMetrics`
Se guarda en `TGraphNodeData.context` (opcional). Calculada en `enrichNodeData` (R3).

| Campo | Tipo | Regla |
|---|---|---|
| `breakdown` | `TContextBreakdown` | §1 |
| `window` | `TContextWindow` | §2 |
| `latency?` | `TLatencyReport \| null` | §5; **opcional**: US1/US4 pueden entregar sin latencia (`null`) y US5 la añade |
| `provisional` | `boolean` | `true` si el nodo está activo |

### 3.2 Cambio en `TGraphNodeData`
| Campo | Tipo | Nota |
|---|---|---|
| `context?` | `TNodeContextMetrics \| null` | **NUEVO**, opcional (como `effort?`) |
| `speedup?` | `TNodeSpeedup \| null` | **NUEVO**, opcional |

Ambos entran en `sameNodeData` con `sameContext`/`sameSpeedup` (§6).

---

## 4. Aceleración por paralelismo (US2)

### 4.1 `TGroupSpeedup`
| Campo | Tipo | Regla |
|---|---|---|
| `groupId` | `string` | `TParallelGroup.id` |
| `size` | `number` | `nodeIds.length` (≥ 2) |
| `serialMs` | `number \| null` | `Σ duración(miembro)`; `null` si falta alguna duración |
| `wallMs` | `number` | `endedAt − startedAt` del grupo |
| `speedup` | `number \| null` | `serialMs / wallMs`; `null` si `wallMs ≤ 0` |
| `efficiency` | `number \| null` | `speedup / size` |
| `provisional` | `boolean` | algún miembro activo |

### 4.2 `TNodeSpeedup`
Resumen por nodo para el badge y el detalle.

| Campo | Tipo | Regla |
|---|---|---|
| `groupId` | `string` | — |
| `size` | `number` | — |
| `serialMs` | `number \| null` | del grupo; `null` si falta alguna duración |
| `wallMs` | `number` | del grupo (`endedAt − startedAt`) |
| `speedup` | `number \| null` | del grupo |
| `efficiency` | `number \| null` | del grupo |
| `provisional` | `boolean` | — |

### 4.3 `TSessionSpeedup`
| Campo | Tipo | Regla |
|---|---|---|
| `serialMs` | `number \| null` | `Σ duración(todos los nodos)` |
| `wallMs` | `number \| null` | longitud de la **unión** de intervalos |
| `speedup` | `number \| null` | `serialMs / wallMs` |

Se incorpora a `TSessionSummary` (`Inspector.entity.ts`) y a la barra de resumen.

---

## 5. Velocidad de respuesta y anomalías (US5)

> **Revisión (feat/latency-accuracy)**: cada muestra trae el desglose del tiempo y la referencia
> pasó de la mediana del total del nodo/agente al ritmo de generación de cada modelo. Se elimina la
> anomalía por rapidez. Detalle y motivo en `contracts/latency-anomaly-contract.md`.

### 5.1 `TLatencySample`
| Campo | Tipo | Regla |
|---|---|---|
| `stepId` | `string` | `id` del mensaje assistant |
| `startedAt` | `number` | `time.created` |
| `model` | `string \| null` | `providerID/id`; `null` si no se reporta |
| `firstOutputMs` | `number \| null` | primer razonamiento o herramienta con hora − `created`; `null` sin ninguno |
| `generationMs` | `number \| null` | `streamed − created` (tiempo de generación; `streamed` es el fin del stream, no el primer token); `null` sin `streamed`. Antes `ttftMs` |
| `totalMs` | `number \| null` | `completed − created`; `null` sin `completed` |
| `toolMs` | `number` | unión de `[ran ?? created, completed]` de las herramientas comunes |
| `subagentMs` | `number` | ídem, de `subagent`/`task` |
| `humanMs` | `number` | ídem, de `question` |
| `topTool` | `string \| null` | herramienta común con más tiempo sumado |
| `outputTokens` | `number \| null` | `tokens.output + tokens.reasoning`; `null` sin tokens |
| `expectedMs` | `number \| null` | `max(500, baseMs + msPerToken × outputTokens)`; `null` sin ritmo o sin tokens |

### 5.2 `TModelPace`
| Campo | Tipo | Regla |
|---|---|---|
| `model` | `string` | `providerID/id` |
| `baseMs` | `number` | ordenada del ajuste; nunca negativa |
| `msPerToken` | `number` | pendiente del ajuste; `0` si no es positiva (entonces `baseMs` es la mediana) |
| `samples` | `number` | respuestas del modelo en el grafo (≥ `MIN_PACE_SAMPLES` = 8) |

### 5.3 `TLatencyAnomaly`
| Campo | Tipo | Regla |
|---|---|---|
| `stepId` | `string` | respuesta lenta |
| `ratio` | `number` | `generationMs / expectedMs` |
| `expectedMs` | `number` | generación esperada |
| `excessMs` | `number` | `generationMs − expectedMs` (≥ `MIN_EXCESS_MS` = 5000) |

### 5.4 `TLatencyReport`
| Campo | Tipo | Regla |
|---|---|---|
| `samples` | `TLatencySample[]` | orden por `startedAt` ascendente |
| `paces` | `TModelPace[]` | ritmo de los modelos del nodo que tienen datos suficientes |
| `anomalies` | `TLatencyAnomaly[]` | vacío si ningún modelo del nodo tiene ritmo |

### 5.5 `TAnomalyThreshold`
Configuración de vista persistida en `localStorage`.

| Campo | Tipo | Regla |
|---|---|---|
| `value` | `number` | por defecto `0.4` (±40%); rango `(0, 1)` |

---

## 6. Impacto en el contexto del padre (US3)

### 6.1 `TParentImpact`
Calculado **bajo demanda** en el hook del Inspector (R5); **no** viaja en el modelo del grafo.

| Campo | Tipo | Regla |
|---|---|---|
| `parentId` | `string` | sesión padre |
| `addedChars` | `number` | caracteres del resultado del hijo inyectados en el padre |
| `addedTokens` | `number \| null` | `round(windowTokensPadre × proporción)` |
| `pctOfParent` | `number \| null` | `addedChars / charsTotalesPadre × 100` |

`null` (o `pctOfParent = null`) cuando el nodo es raíz o no se halla el tool de spawn → "no disponible".

---

## 7. Reglas de reconciliación (obligatorias)

En `lib/reconcile/comparators.ts`:

- `sameContext(a, b)`: compara `provisional` y, con igualdad de valor, `breakdown` (buckets: categoría/chars/tokens/pct), `window` (campos) y `latency` (samples con todo su desglose, paces y anomalies).
- `sameSpeedup(a, b)`: compara `groupId`, `size`, `speedup`, `efficiency`, `provisional`.
- `sameNodeData` **debe** añadir `sameContext(a.context, b.context)` y `sameSpeedup(a.speedup, b.speedup)`. Sin esto, el nodo no se reemplaza y los valores quedan congelados (AGENTS §11).

---

## 8. Estados y transiciones

- **Provisional → cerrado**: mientras el nodo está activo (`isActiveStatus`), `context.provisional` y `speedup.provisional` son `true`; al cerrarse los tiempos, se recalcula a `false`. Nunca regresa de cerrado a provisional dentro de la misma visita.
- **Sin datos → datos**: `context` pasa de `null`/ausente a un objeto cuando el enriquecimiento carga los mensajes del nodo (`enrichment: 'pending' → 'ready'`). Un refetch por evento no lo degrada.
- **Sin ritmo → anomalía**: mientras el modelo tenga menos de `MIN_PACE_SAMPLES` respuestas en el grafo, `anomalies` es vacío; al cargar más nodos, la detección se activa.
