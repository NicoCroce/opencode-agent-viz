# Contrato — Velocidad de respuesta y anomalías

**Feature**: `010-context-metrics-insights`
**Cubre**: FR-018..FR-023 · SC-006
**Implementa**: `Domains/Graph/lib/metrics/latency.ts` y `Domains/Graph/lib/metrics/modelPace.ts` (puros),
`Domains/Graph/lib/metrics/anomalyThreshold.ts`, `Domains/Graph/Graph.entity.ts` (`TLatencySample`,
`TModelPace`, `TLatencyAnomaly`, `TLatencyReport`), `Domains/Inspector/lib/latencyBreakdown.ts`,
`Domains/Inspector/Components/LatencySection.tsx`, `LatencySampleRow.tsx` y
`Domains/Graph/Components/AgentNodeLatencyMark.tsx` (marca).

> **Revisión (feat/latency-accuracy)**: la versión original comparaba la latencia **total** de cada
> respuesta con la mediana del nodo (o del agente) con una banda de ±40 % y marcaba tanto la lentitud
> como la rapidez. Con 18.741 respuestas reales marcaba el 56 % y dejaba como «lento» al 70 % de los
> nodos: la respuesta final genera unas 3,3 veces más tokens que la mediana, y el total suma esperas
> de herramientas, subagentes y del usuario que no son del modelo. Ahora cada respuesta trae el
> desglose de en qué se fue el tiempo, y solo se marca la **generación** que tarda bastante más de
> lo esperado para los tokens que produjo, según el ritmo de su modelo. Con el umbral por defecto se
> marca alrededor del 4 %. Este documento describe el criterio vigente.

---

## 1. Tipos

```ts
export interface TLatencySample {
  stepId: string;
  startedAt: number;
  model: string | null;          // providerID/id
  firstOutputMs: number | null;  // primera salida con hora − created
  generationMs: number | null;   // time.streamed − time.created
  totalMs: number | null;        // time.completed − time.created
  toolMs: number;                // herramientas, sin subagentes ni preguntas
  subagentMs: number;            // subagent/task
  humanMs: number;               // question
  topTool: string | null;        // la herramienta que más tiempo ejecutó
  outputTokens: number | null;   // output + reasoning
  expectedMs: number | null;     // generación esperada por TModelPace
}

export interface TModelPace {
  model: string;      // providerID/id
  baseMs: number;
  msPerToken: number;
  samples: number;
}

export interface TLatencyAnomaly {
  stepId: string;
  ratio: number;      // generationMs / expectedMs
  expectedMs: number;
  excessMs: number;   // generationMs − expectedMs
}

export interface TLatencyReport {
  samples: TLatencySample[];
  paces: TModelPace[];   // ritmo de los modelos que usó el nodo
  anomalies: TLatencyAnomaly[];
}
```

## 2. Derivación (FR-018, FR-019)

```ts
// Domains/Graph/lib/metrics/latency.ts (puro)
export const deriveLatency = (
  messages: TSessionMessage[],
  options: { threshold?: number; paces?: Record<string, TModelPace> },
): TLatencyReport;
```

- **Muestras (FR-018)**: una por mensaje assistant con `time.completed`, ordenadas por `startedAt`.
  - `generationMs = streamed − created`. `time.streamed` marca el **fin** del stream del modelo, no
    el primer token (en el 88 % de las respuestas llega más de 0,5 s después de la primera salida);
    por eso el campo, que antes se llamaba `ttftMs`, se rotula «generación».
  - `firstOutputMs`: desde `created` hasta el primer razonamiento o llamada a herramienta con hora.
    Aproxima el primer token, porque el texto no trae hora. `null` sin ninguna salida con hora.
  - `toolMs`, `subagentMs` y `humanMs`: unión de los intervalos `[ran ?? created, completed]` de las
    herramientas de la respuesta, separadas por tipo. Las llamadas en paralelo cuentan una vez y las
    que no terminaron se omiten. `topTool` es la herramienta común con más tiempo sumado.
  - `outputTokens = tokens.output + tokens.reasoning`; `null` si la respuesta no reporta tokens.
  - Los tramos no tienen por qué sumar `totalMs`: en sesiones sin `time.ran` la generación y las
    herramientas pueden solaparse. La UI los muestra junto al total, sin forzar la suma.
- **Serie (FR-019)**: `samples` es la serie que lista la UI.

## 3. Referencia: ritmo por modelo (FR-020)

```ts
// Domains/Graph/lib/metrics/modelPace.ts (puro)
export const MIN_PACE_SAMPLES = 8;
export const deriveModelPaces = (
  messageLists: ReadonlyArray<TSessionMessage[]>,
): Record<string, TModelPace>;
```

- Se estima con las respuestas de **todos los nodos listos del grafo**, agrupadas por `providerID/id`.
  Solo entran las que tienen tokens y `generationMs > 0`.
- Ajuste por mínimos cuadrados de `generationMs ≈ baseMs + msPerToken × tokens`. En los datos
  reales el tiempo del modelo sigue a los tokens generados con R² de 0,94 a 0,99.
- Para que una respuesta anómala no arrastre el ritmo, se descartan las que tardan más de 3× lo
  predicho y se ajusta otra vez (si quedan al menos `MIN_PACE_SAMPLES`).
- Si la pendiente sale ≤ 0, `msPerToken = 0` y `baseMs` es la mediana. `baseMs` nunca es negativa.
- Con menos de `MIN_PACE_SAMPLES` respuestas no hay ritmo: esas respuestas no se evalúan
  (`expectedMs = null`) y la UI avisa «sin datos suficientes».
- `expectedMs = max(MIN_EXPECTED_MS, baseMs + msPerToken × outputTokens)`, con `MIN_EXPECTED_MS = 500`.

## 4. Detección (FR-021)

```ts
export const MIN_EXCESS_MS = 5000;
export const detectAnomalies = (
  samples: TLatencySample[],
  threshold: number,
): TLatencyAnomaly[];
```

- Una respuesta es **lenta** si `generationMs > (1 + threshold) × expectedMs` **y**
  `generationMs − expectedMs ≥ MIN_EXCESS_MS`. El exceso mínimo evita marcar respuestas cortas que
  duplican lo esperado pero solo pierden un par de segundos.
- Solo cuenta el tiempo del modelo. Las esperas de herramientas, subagentes y del usuario se
  muestran en el desglose y no se marcan.
- La rapidez no se marca: una respuesta rápida no es un problema que haya que investigar.

## 5. Umbral configurable (FR-022)

```ts
// Application/Helpers/anomalyThreshold.ts
export const DEFAULT_ANOMALY_THRESHOLD = 1; // +100 %: el doble de lo esperado
export const ANOMALY_THRESHOLD_STORAGE_KEY = 'opencode-agent-viz:latency-threshold';
// clampThreshold acota a [0.25, 3] y cae al default con valores no finitos.
```

- Persistido en `localStorage` con una clave **nueva**: el umbral cambió de significado y un valor
  guardado con el criterio anterior (±40 % sobre la mediana del total) no aplica.
- El control va de +25 % a +300 % en pasos de 25 y se muestra como factor (`×2.0`).
- Cambiar el umbral recalcula las marcas (FR-022, escenario 5).

## 6. Presentación (FR-019, FR-023)

- **Nodo**: marca «▲ lenta» con color cuando la **última** respuesta del nodo es lenta. La etiqueta
  accesible lleva la magnitud: «Respuesta lenta: ×2.4 lo esperado para sus tokens».
- **Detalle**: sección **Latencia** con:
  1. **Reparto del tiempo** del nodo: modelo, herramientas, subagentes y espera del usuario, con su
     duración y porcentaje.
  2. **Ritmo esperado del modelo**: `base + ms/token · respuestas` de cada modelo del nodo.
  3. **Umbral de lentitud** con su explicación.
  4. **Respuestas**: hora, total, marca «Lenta ×N» y el desglose ordenado de mayor a menor (el primer
     tramo es la causa principal), con los tokens, lo esperado y la primera salida.
  5. **Respuestas lentas**: magnitud, exceso y lo esperado (FR-023).

## 7. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| L1 | Muestras con generación, total, tokens y modelo correctos desde `time`/`tokens` | `latency.spec.ts` |
| L2 | Desglose: herramientas, subagentes y usuario separados, desde `ran`, sin doble conteo | `latency.spec.ts` |
| L3 | El ritmo por modelo recupera base y pendiente, y resiste una respuesta anómala | `modelPace.spec.ts` |
| L4 | Sin ritmo del modelo o sin tokens → sin esperado ni anomalía | `latency.spec.ts` |
| L5 | Lenta solo si supera el umbral **y** el exceso mínimo; nunca por rapidez ni por esperas | `latency.spec.ts` |
| L6 | El enriquecimiento usa el ritmo del grafo y respeta el umbral | `enrichNodeData.spec.ts` |
| L7 | `clampThreshold` acota a `[0.25, 3]` y cae al default con NaN | `anomalyThreshold.spec.ts` |
| L8 | La marca del nodo refleja la última respuesta lenta, con su magnitud | `AgentNodeLatencyMark.spec.tsx` |
| L9 | `LatencySection` muestra reparto, ritmo, desglose y lentas | `LatencySection.spec.tsx`, `latencyBreakdown.spec.ts` |
