# Contrato — Velocidad de respuesta y anomalías

**Feature**: `010-context-metrics-insights`
**Cubre**: FR-018..FR-023 · SC-006
**Implementa**: `Domains/Graph/lib/metrics/latency.ts` (puro), `Domains/Graph/lib/metrics/anomalyThreshold.ts`,
`Domains/Graph/Graph.entity.ts` (`TLatencySample`, `TLatencyAnomaly`, `TLatencyReport`),
`Domains/Inspector/Components/LatencySection.tsx`, `Domains/Inspector/Components/AgentNode` (marca).

---

## 1. Tipos

```ts
export interface TLatencySample {
  stepId: string;
  startedAt: number;
  generationMs: number | null;   // time.streamed − time.created
  totalMs: number | null;  // time.completed − time.created
}

export interface TLatencyAnomaly {
  stepId: string;
  ratio: number;
  direction: 'slow' | 'fast';
  referenceMs: number;
  reference: 'node' | 'agent';
}

export interface TLatencyReport {
  samples: TLatencySample[];
  medianMs: number | null;
  reference: 'node' | 'agent' | null;
  anomalies: TLatencyAnomaly[];
}
```

## 2. Derivación (FR-018, FR-019, FR-020)

```ts
// Domains/Graph/lib/metrics/latency.ts (puro)
export const MIN_SAMPLES = 3;

export const deriveLatency = (
  messages: TSessionMessage[],
  options: { threshold: number; agentMedianMs: number | null },
): TLatencyReport;
```

- **Muestras (FR-018)**: una por mensaje assistant con `time.completed`; `generationMs = streamed − created` (si `streamed`), `totalMs = completed − created`. Ordenadas por `startedAt` ascendente.
  - **Corrección posterior**: el campo se llamaba `ttftMs`, pero `time.streamed` marca el **fin** del stream del modelo, no el primer token (verificado con 18.741 respuestas reales: en el 88 % `streamed` llega más de 0,5 s después de la primera salida). Se renombró a `generationMs` y la UI lo rotula «generación».
- **Serie (FR-019)**: `samples` es la serie temporal que la UI grafica.
- **Referencia (FR-020)**: `medianMs` = mediana de `totalMs` de las muestras del nodo. Si hay **menos de `MIN_SAMPLES`** muestras propias con `totalMs`, se usa `agentMedianMs` (mediana del mismo agente) y `reference = 'agent'`; si tampoco hay, `medianMs = null`, `reference = null`, `anomalies = []` (sin baseline no hay alerta).

## 3. Detección (FR-021, FR-022)

```ts
export const detectAnomalies = (
  samples: TLatencySample[],
  referenceMs: number | null,
  reference: 'node' | 'agent',
  threshold: number,
): TLatencyAnomaly[];
```

- Para cada muestra con `totalMs`: `ratio = totalMs / referenceMs`.
- `direction = 'slow'` si `ratio > 1 + threshold`; `'fast'` si `ratio < 1 − threshold`; si no, no hay anomalía.
- **FR-021**: la dirección `'fast'` (rapidez anómala) se marca igual que `'slow'`.
- La muestra usada como parte de su propia referencia no se auto-marca: la referencia se calcula con la **mediana** (robusta), y una muestra solo se evalúa contra la mediana; se acepta el sesgo menor (documentado en R6).

## 4. Umbral configurable (FR-022)

```ts
// Domains/Graph/lib/metrics/anomalyThreshold.ts
export const DEFAULT_ANOMALY_THRESHOLD = 0.4; // ±40% (R7)
export const clampThreshold = (value: number): number =>
  Number.isFinite(value) ? Math.min(0.95, Math.max(0.05, value)) : DEFAULT_ANOMALY_THRESHOLD;
```

- Persistido en `localStorage` (patrón de `useInspectorPanel`), clave propia. `clampThreshold` acota a `(0.05, 0.95)`.
- Cambiar el umbral recalcula las marcas (FR-022, escenario 5).

## 5. Presentación (FR-019, FR-023)

- **Nodo**: marca textual + color cuando la **última** muestra del nodo es anómala; etiqueta "Respuesta lenta" / "Respuesta rápida" (no solo color, a11y).
- **Detalle**: sección **Latencia** con la serie (generación y total), la mediana de referencia y la lista de anomalías con `ratio`, `referenceMs` y `reference` (FR-023).

## 6. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| L1 | Muestras con `generationMs`/`totalMs` correctos desde `time` | spec puro `latency.spec.ts` |
| L2 | Con ≥ 3 muestras, la referencia es la mediana del nodo | spec puro |
| L3 | Con < 3 muestras y mediana de agente, la referencia es del agente | spec puro |
| L4 | Sin baseline → `anomalies = []` | spec puro |
| L5 | Muestra por encima del umbral → `slow`; por debajo → `fast` | spec puro |
| L6 | Dentro de la banda → sin anomalía | spec puro |
| L7 | `clampThreshold` acota y cae al default con NaN | spec puro `anomalyThreshold.spec.ts` |
| L8 | La marca del nodo refleja la última muestra anómala | spec de nodo |
| L9 | `LatencySection` lista anomalías con magnitud y referencia | spec de `LatencySection` |
