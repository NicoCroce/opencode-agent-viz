# Data Model — Panel de eficiencia de sesión

**Feature**: `015-session-efficiency-panel` | **Date**: 2026-10-23 | **Plan**: [plan.md](./plan.md)
**Contrato**: [contracts/efficiency-engine-contract.md](./contracts/efficiency-engine-contract.md)

Este documento describe las entidades del motor puro, sus invariantes y los estados de la capa.
El motor no conoce React, el SDK, el grafo ni el histórico: recibe mensajes y metadatos de sesión y
devuelve un informe inmutable.

## 1. Tipos de entrada

### 1.1 `TEfficiencyInput`

```ts
export type TEfficiencySessionStatus = 'active' | 'idle';

export interface TEfficiencySessionMeta {
  /** Sesión padre en el subárbol; ausente en la raíz. */
  parentID?: string;
  /** `active` si el nodo está en curso (running/retrying/compacting/waiting). */
  status?: TEfficiencySessionStatus;
}

export interface TEfficiencyInput {
  rootSessionId: string;
  /** Solo las sesiones con mensajes cargados; una clave ausente = no cargada. */
  messagesBySession: Record<string, TSessionMessage[]>;
  /** Raíz + subárbol, con o sin mensajes; el motor detecta las ausencias. */
  sessions: Record<string, TEfficiencySessionMeta>;
  /** El grafo declara el subárbol truncado; cuenta como parcial para la confianza. */
  truncated?: boolean;
  /** Reloj inyectado; solo se usa para la duración del turno abierto. */
  now?: number;
}
```

**Invariantes**

- `rootSessionId` debe existir en `sessions`; si no, el motor trata el informe como `no_data`.
- `messagesBySession[id] === undefined` significa “no cargada”; `[]` significa “cargada y vacía”.
  El motor nunca sustituye una ausencia por `[]`.
- `messagesBySession` puede contener sesiones que no estén en `sessions` (p. ej. un subárbol
  truncado); se analizan, pero se anotan como fuera del mapa.
- `truncated === true` declara el subárbol incompleto: el motor lo trata como parcial para la
  confianza (§4.6) sin inventar sesiones ausentes ni añadir notas.
- Los mensajes de cada sesión están ordenados por `info.time.created` ascendente (contrato de
  `collectAllMessages`); el motor no reordena el array original.

### 1.2 Proyección desde Infrastructure

`buildEfficiencySessions(graph: TGraphModel)` (Infrastructure, puro):

- `parentID` = `source` de la arista cuyo `target` es el nodo (el nodo raíz no tiene).
- `status` = `isActiveStatus(node.data.status) ? 'active' : 'idle'`.
- Incluye **todos** los nodos del grafo (raíz + subárbol cargado). El grafo truncado se declara
  aparte (`truncated`).

## 2. Tipos de salida

### 2.1 Enumeraciones

```ts
export type TDimensionKey = 'entrada' | 'ejecucion' | 'contexto' | 'resultado';
export type TEfficiencyStatus = 'ok' | 'in_progress' | 'insufficient' | 'no_data';
export type TBand = 'eficiente' | 'aceptable' | 'mejorable' | 'friccion';
export type TConfidence = 'alta' | 'media' | 'baja';
export type TSeverity = 'alta' | 'media' | 'baja';
export type TRuleId =
  | 'INP-1' | 'INP-2' | 'INP-3' | 'INP-4'
  | 'RES-1' | 'RES-2' | 'RES-3' | 'RES-4' | 'RES-5' | 'RES-6';
export type TIndicatorKey =
  | 'INP-1' | 'INP-2' | 'INP-3'
  | 'RES-1' | 'RES-2' | 'RES-3'
  | 'RES-4' | 'CACHE'
  | 'OUTCOME' | 'OPEN_ERRORS';
```

### 2.2 `TEfficiencyReport`

```ts
export interface TEfficiencyReport {
  status: TEfficiencyStatus;
  score: number | null;          // entero 0–100; null si no se puede puntuar
  band: TBand | null;            // null si score === null
  coverage: number;              // 0–100 (puntos de peso disponibles)
  confidence: TConfidence | null;// null solo en no_data
  dimensions: TDimensionResult[];
  findings: TFinding[];          // solo penalizantes, máx. 10
  weakSignals: TFinding[];       // no penalizan
  turns: TTurnAnalysis[];
  totals: TEfficiencyTotals;
  notes: string[];
}
```

**Invariantes**

- `score === null` ⇔ `band === null`; `score !== null` ⇔ `status === 'ok'`.
- `status === 'no_data'` ⇒ `score === null`, `confidence === null`, `dimensions.length === 0`,
  `findings.length === 0`, `turns.length === 0`.
- `status === 'in_progress' | 'insufficient'` ⇒ `score === null`, pero las dimensiones, los conteos
  y los totales disponibles se conservan.
- `findings.every(f => f.penalizes)` y `weakSignals.every(f => !f.penalizes)`.
- `findings.length + weakSignals.length <= 20` (catálogo real ≤ 11).
- Todos los hallazgos tienen `evidence.messageId` no vacío.
- `coverage` se calcula con la fórmula de §4.4 y nunca es NaN; `0 <= coverage <= 100`.
- `turns` está ordenado por `index` 1..N; como máximo el último es `closed: false`.
- `notes` no contiene duplicados y su orden es determinista (§7).

### 2.3 `TDimensionResult` y `TIndicatorResult`

```ts
export interface TIndicatorResult {
  key: TIndicatorKey;
  /** Proporción observada; para OUTCOME es la pérdida (1 − valor). */
  ratio: number;
  /** Tope de tolerancia (o 1 para OUTCOME/OPEN_ERRORS). */
  cap: number;
  /** Aporte 0–1 (para CACHE es calidad, no fricción). */
  score: number;
  /** Tamaño de muestra observado. */
  count: number;
  /** Mínimo de muestra exigido; 0 = sin mínimo. */
  minimum: number;
}

export interface TDimensionResult {
  key: TDimensionKey;
  /** Peso completo de la dimensión: 30/30/15/25. */
  weight: number;
  /** Valor 0–100; null si la dimensión se omite. */
  value: number | null;
  available: boolean;
  indicators: TIndicatorResult[];
}
```

**Invariantes**

- `weight` ∈ {30, 30, 15, 25}; la suma de las cuatro es 100.
- `available === false` ⇔ `value === null`.
- Los indicadores de una dimensión omitida pueden incluir conteos (para explicar el mínimo), pero
  `value` sigue `null`; la UI no los usa para puntuar.
- `score` se acota a [0,1]; `ratio >= 0`; `cap > 0`; `count >= 0`; `minimum >= 0`.
- Para `CACHE`, `score = min(1, ratio / cap)`; para el resto, `score = 1 − min(1, ratio / cap)`.
  `RES-4` codifica la pérdida en `ratio = max(0, n − 1)` y `OUTCOME` en `ratio = 1 − valor`, así que
  la misma fórmula produce su aporte.
- `OUTCOME`: `count = 1` si hay outcome conocido, `minimum = 1`; `ratio = 1 − valor`, donde
  `valor` es 1 (succeeded), 0,5 (interrupted) o 0 (failed); `cap = 1`, `score = valor`. Sin outcome,
  no se incluye el indicador.
- `OPEN_ERRORS`: `ratio = openErrors ? 1 : 0`, `cap = 1`, `score = 1 − ratio`, `count = 1`,
  `minimum = 0`.
- `RES-4`: `ratio = max(0, n − 1)`, `cap = 2`, `count = n`, `minimum = 0`.
- `CACHE`: `ratio = hitRate`, `cap = 0,6`, `count = pasos con tokens`, `minimum = 10`; solo se
  incluye si hay evidencia de caché (algún `cache.read + cache.write > 0`).
- `INP-1`: `minimum = 3`, `count = pares elegibles`; `INP-2`: `count = turnos cerrados`;
  `INP-3`: `count = preguntas con texto`; `RES-1`: `count = tool calls`, `minimum = 10`;
  `RES-2`: `count = pasos`; `RES-3`: `count = tool calls`.

### 2.4 `TEfficiencyTotals`

```ts
export interface TEfficiencyTotals {
  cost: number | null;          // suma assistant.cost; null si no se reportó
  tokensIn: number | null;
  tokensOut: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  windowTokens: number | null;  // raíz: input + cache.read + cache.write del último assistant con tokens
  latencyP95Ms: number | null;  // tools completadas de todo el subárbol
  slowToolCalls: number;        // tools > 60 000 ms
  compactions: number;          // completed (auto + manual)
  retries: number;              // assistant con retry
  toolErrors: number;
  toolCalls: number;
}
```

**Invariantes**

- Los totales de token/coste son **assistant-only**; no incluyen compactación (se muestra aparte).
- Si no se reportó ningún coste/token, el campo es `null`, nunca `0` por defecto.
- Los conteos (`compactions`, `retries`, `toolErrors`, `toolCalls`, `slowToolCalls`) son enteros ≥0
  y `0` es un valor real.
- `latencyP95Ms` solo se calcula con tools completadas (`completed − (ran ?? created)`); sin
  muestras es `null`.
- `windowTokens` se mide en la raíz; si la raíz no reporta tokens, es `null` (no se sustituye por un
  subagente).

### 2.4.1 `TEfficiencyReference` (contraste, opcional)

```ts
export interface TEfficiencyReference {
  cost: number | null;
  tokens: {
    input: number | null;
    output: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
  } | null;
}
```

Subconjunto estructural de `TNodeMetrics` (`summary.metrics`) que la página pasa al overlay para el
contraste de totales. El dominio no importa `Graph` ni `Inspector`; `TNodeMetrics` lo satisface por
tipado estructural. Si no coincide con los totales derivados, la UI explica que la cabecera puede
incluir compactación; no se recalcula `summarizeSession`.

### 2.5 `TTurnAnalysis`

```ts
export interface TTurnAnalysis {
  index: number;                 // 1-based, cronológico
  userMessageId: string;
  at: number;                    // user.time.created
  prompt: string;                // texto completo; la vista recorta a 120 code points
  promptTokens: number;          // tokens de palabra (incluye stopwords)
  closed: boolean;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  clarifications: number;        // tools question/form de la raíz en la ventana
  steps: number;                 // assistant de raíz + subárbol en la ventana
  toolCalls: number;
  toolErrors: number;
  retries: number;
  cost: number | null;
  durationMs: number | null;
  signals: TRuleId[];            // reglas con evidencia en este turno
}
```

**Invariantes**

- `index` es contiguo desde 1 y el orden es por `at`.
- `closed === false` solo en el último turno abierto; ese turno no entra en denominadores.
- `outcome === 'interrupted'` si el turno se cerró por el siguiente `user`; si se cerró por `idle`,
  es el `outcome` del `idle`.
- `cost` es la suma de `assistant.cost` de la ventana; `null` si ninguno se reportó.
- `durationMs` = cierre − `at`; para el turno abierto, `now − at` si hay `now`, si no `null`.
- `signals` solo contiene `ruleId` de hallazgos/señales cuya evidencia cae en la ventana.

### 2.6 `TFinding`, `TEvidence`, `TFactor`, `TOmission`

```ts
export interface TEvidence {
  sessionId: string;
  messageId?: string;
  toolId?: string;
  formId?: string;
  at?: number;
  turnIndex?: number;
}

export interface TFinding {
  ruleId: TRuleId;
  severity: TSeverity;
  dimension: TDimensionKey | null;
  penalizes: boolean;
  evidence: TEvidence;
  /** Cita completa con ancla y texto; la vista recorta a 120 code points. */
  quote: string;
  /** Condición medida en lenguaje neutral. */
  condition: string;
  recommendation: string;
}

export interface TFactor {
  key: TIndicatorKey;
  dimension: TDimensionKey;
  label: string;
  count: number;
  kind: 'resta' | 'suma';
}

export interface TOmission {
  key: TDimensionKey;
  weight: number;
  reason: string;
  indicator?: TIndicatorKey;
  count?: number;
  minimum?: number;
}
```

**Invariantes**

- `TFinding.evidence.messageId` es obligatorio para emitir; sin él, la regla no produce hallazgo.
- `penalizes === false` ⇒ `dimension` puede ser la dimensión relacionada (RES-4 con n=1) o `null`;
  la UI lo coloca en señales débiles por `penalizes`, no por `dimension`.
- `TFactor` se deriva de las dimensiones/indicadores (no es parte del contrato del motor); siempre
  hay 2–3 cuando `status === 'ok'`. El orden se calcula internamente por impacto
  (`peso_dimensión × peso_indicador × (1 − score)`), pero la tarjeta solo muestra el conteo y el
  signo; los puntos exactos viven en la tabla de “Cómo se calcula”.
- `TOmission` se deriva de las dimensiones no disponibles y de la caché omitida; `reason` es copy
  neutral y determinista.

## 3. `TSessionEfficiencyResult` (hook)

```ts
export interface TUseSessionEfficiencyParams {
  rootSessionId: string | null;
  sessions: Record<string, TEfficiencySessionMeta>;
  /** `node.data.enrichment === 'ready'` del nodo raíz. */
  rootReady: boolean;
  /** El grafo declara el subárbol truncado. */
  truncated?: boolean;
  /** Error estructural del grafo (`graph.isError`). */
  graphError?: boolean;
  /** `openedAt` fijo del panel; solo para el turno abierto. */
  now?: number;
  /** El panel está abierto; con false no se observa la caché. */
  enabled: boolean;
}

export interface TSessionEfficiencyResult {
  report: TEfficiencyReport | null;
  isLoading: boolean;
  isError: boolean;
  isPartial: boolean;
  missingSessionIds: string[];
}
```

- `report === null` mientras no hay datos de la raíz o el panel está cerrado.
- Si `rootReady === true` y la raíz no está en caché, el hook pasa
  `messagesBySession[rootSessionId] = []` para que el motor distinga “cargada y vacía” de “no
  cargada” y devuelva `no_data`; con `rootReady === false` no llama al motor y muestra carga.
- `isLoading` solo si no hay informe, la raíz no está cacheada, `rootReady` es falso y no hay error.
- `isError` si `graphError` y no hay datos previos; con un
  informe previo, el error se muestra como banner y no lo vacía (FR-037).
- `isPartial` si falta al menos una sesión del subárbol (caché ausente) o `truncated` es true. La
  raíz no cuenta como “parcial”: su ausencia es carga/vacío/error.
- `truncated` se propaga tal cual a `TEfficiencyInput.truncated`; afecta a la confianza del motor
  (§4.6), no a `missingSessionIds`.
- `missingSessionIds` son ids del subárbol sin mensajes cargados, ordenados alfabéticamente.

## 4. Reglas de puntuación (resumen normativo)

### 4.1 Pesos

| Dimensión | Peso | Indicadores (peso) |
|---|---:|---|
| Entrada | 30 | INP-1 45 %, INP-2 35 %, INP-3 20 % |
| Ejecución | 30 | RES-1 45 %, RES-2 35 %, RES-3 20 % |
| Contexto | 15 | RES-4 70 %, CACHE 30 % (opcional) |
| Resultado | 25 | OUTCOME 70 %, OPEN_ERRORS 30 % |

### 4.2 Aportes

- Fricción: `1 − min(1, r / cap)`.
- Caché: `min(1, hitRate / 0,6)`.
- `r` y los denominadores:
  - INP-1: pares similares / pares elegibles. Un par es elegible si es consecutivo, el primer turno
    se cerró con `idle`, no hubo escritura entre ambos y ambos prompts tienen ≥6 tokens.
  - INP-2: turnos interrumpidos / turnos cerrados.
  - INP-3: preguntas repetidas / preguntas con texto.
  - RES-1: errores / tool calls.
  - RES-2: reintentos / pasos.
  - RES-3: llamadas redundantes / tool calls.
  - RES-4: `max(0, n − 1)` con `cap = 2`.
  - CACHE: `cache.read / (cache.read + input)` en pasos de la raíz con tokens.
  - OUTCOME: `ratio = 1 − valor`, con `valor` = 1 (succeeded), 0,5 (interrupted) o 0 (failed);
    `score = valor`.
  - OPEN_ERRORS: 1 con error abierto, 0 sin él.

### 4.3 Dimensión y global

- Dimensión: `Σ (peso_indicador × score_indicador) / Σ peso_indicador` sobre indicadores
  disponibles; `value = 100 × resultado`.
- Global: `Σ (peso_dimensión × value_dimensión) / Σ peso_dimensión` sobre dimensiones disponibles;
  `score = Math.round(resultado)`.

### 4.4 Cobertura

```text
coverage = Σ peso_dimensión(disponible) − (contexto disponible && caché omitida ? 15 × 0,30 : 0)
```

- Dimensión omitida: pierde su peso completo.
- Caché omitida: pierde 4,5 puntos.
- No hay multiplicador por sesiones cargadas (R12).

### 4.5 Guardas y estado

| Condición | `status` | `score` |
|---|---|---|
| No hay mensajes en ninguna sesión | `no_data` | `null` |
| Alguna sesión activa | `in_progress` | `null` |
| `closedTurns < 2` o `coverage < 60` | `insufficient` | `null` |
| Resto | `ok` | entero 0–100 |

Precedencia: `no_data` → `in_progress` → `insufficient` → `ok`.

### 4.6 Confianza

- `no_data` → `null`.
- `alta`: `coverage >= 85` y todas las dimensiones disponibles alcanzan **el doble de su mínimo de
  muestra** cuando tienen mínimo de muestra (Entrada ≥6 pares; Ejecución ≥20 calls y ≥10 pasos;
  Contexto sin mínimo; Resultado basta con outcome conocido) y el subárbol no es parcial.
- `media`: `coverage >= 70` y no alta.
- `baja`: `coverage < 70` o subárbol parcial.

Por “subárbol parcial” se entiende que falta al menos una sesión del mapa o que el grafo declara
`truncated === true`; el truncado no añade sesiones ausentes ni `notes`, solo rebaja la confianza.

### 4.7 Bandas

| Entero | Banda |
|---:|---|
| 85–100 | eficiente |
| 70–84 | aceptable |
| 50–69 | mejorable |
| 0–49 | fricción |

## 5. Turnos y hechos internos

### 5.1 `TFacts` (interno, no exportado en el informe)

```ts
interface TFacts {
  users: TUserFact[];                 // solo raíz
  assistants: TAssistantFact[];       // raíz + subárbol
  tools: TToolFact[];                 // raíz + subárbol, con firma/canónico
  idles: TIdleFact[];                 // solo raíz
  compactions: TCompactionFact[];     // raíz + subárbol
  turns: TTurnAnalysis[];
  closedTurns: number;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  openErrors: boolean;
  toolErrors: number;
  retries: TRetryFact[];
  redundantCalls: TToolFact[];
  reformulationPairs: TReformulationPair[];
  eligiblePairs: number;
  interruptions: TInterruptionFact[];
  questionCalls: TQuestionFact[];
  repeatedQuestions: TQuestionFact[];
  firstWrite: TToolFact | null;
  filesTouched: number;
  toolDurationsMs: number[];
  rootTokenSteps: TTokenStep[];
  windowTokens: number | null;
  missingSessionIds: string[];
}
```

`TFacts` se construye en **una pasada** y es la única fuente de conteos; las reglas y el score no
recalculan.

### 5.2 Ciclo de vida de un turno

```text
[user raíz]
   │
   ├─ primer idle con ≥1 paso ─────────────► cerrado (outcome del idle)
   ├─ siguiente user antes del idle ───────► cerrado (outcome: interrupted)
   └─ sin cierre ──────────────────────────► abierto (fuera de denominadores)

idle sin pasos del turno actual:
   ├─ hay un turno anterior cerrado por ese user ─► se ignora (cancelación del anterior)
   └─ es el primer turno / no hay anterior ───────► cierra el turno vacío
```

- Un turno cerrado no se reabre.
- El turno abierto se muestra al final con `closed: false` y `outcome: null`.
- Las herramientas y pasos se asignan por `[at, cierre)`; lo que cae fuera de todo turno cuenta en
  los totales pero no en métricas de turno.

### 5.3 Ciclo de vida de la capa

```text
cerrada
  │ open(trigger)                  │ close()/Escape/backdrop
  ▼                                ▼
abierta ── rootId cambia ───────► cerrada (reset en render)
  │
  ├─ sin caché raíz ─────────────► cargando (skeleton)
  ├─ error raíz sin datos ───────► error (EmptyScreenError)
  ├─ raíz ready sin mensajes ────► vacío (no_data)
  ├─ subárbol parcial ───────────► informe + banner parcial
  └─ datos ──────────────────────► in_progress | insufficient | ok
```

- Exclusión mutua: abrir histórico cierra eficiencia; abrir eficiencia cierra histórico.
- `Escape` pertenece al diálogo; `useWorkspaceEscape` no registra su listener mientras está abierto.
- Al cerrar, el foco vuelve al disparador (`open(trigger)`), si sigue en el documento.

### 5.4 Ciclo de la caché

```text
ausente ──(enriquecimiento del grafo)──► cargada
cargada ──(setQueryData de eventos)────► actualizada (re-análisis memoizado)
cargada ──(refetch/evento con error)───► datos previos + banner “no actualizado”
```

- `undefined` ≠ `[]`; una sesión sin datos no se inventa como vacía.
- El subárbol no se fetchea al abrir; solo se observa.

## 6. Validaciones y errores

| Regla | Comprobación | Resultado |
|---|---|---|
| Pesos de dimensión | suma 100 | Constante de `thresholds.ts`; test |
| Pesos de indicador | suma 1 por dimensión | Constante; test |
| Caps | >0 | Constante; test |
| Mínimos | ≥0 | Constante; test |
| Score | entero 0–100 | `Math.round` + clamp; test |
| Bandas | 85/70/50 | Test de límites 84/85, 69/70, 49/50 |
| Cobertura | 0–100, fórmula §4.4 | Test cache omitida/contexto omitido |
| Confianza | regla §4.6 | Test alta/media/baja/parcial |
| Hallazgo | `evidence.messageId` presente | Regla no emite sin ancla; test |
| Cap de hallazgos | ≤10 penalizantes | Test con fixture de muchas reglas |
| Turnos | índices 1..N; ≤1 abierto al final | Test de segmentación |
| Totales | `null` si no hay dato; enteros ≥0 | Test de sesión sin tokens/coste |
| Determinismo | misma entrada → mismo output | Test de doble ejecución + ausencia de `Date.now`/`Math.random` |
| Sin I/O | `lib/` no importa SDK, React ni servicios | Revisión + lint |

## 7. Notas (`notes`) y orden determinista

Se añaden, en este orden, solo si aplican:

1. `Subárbol parcial: N sesiones sin mensajes cargados; el análisis puede estar incompleto.`
2. `El grafo está truncado: faltan agentes del subárbol.` (la añade la UI/Infraestructura, no el
   motor, porque el motor no conoce el truncamiento del grafo).
3. `Tokens no disponibles: la ventana de contexto y la caché se omiten.`
4. `La caché no está reportada por el proveedor; Contexto se calcula solo con compactaciones.`
5. `La compactación del turno N puede afectar a los turnos siguientes.` (si una compactación cae
   dentro de un turno cerrado).
6. `El turno abierto no entra en los denominadores.` (si hay turno abierto).
7. `No hay un cierre (idle) para la sesión; el resultado se omite.` (si no hay outcome).
8. `Los totales derivan de los pasos assistant; la compactación se muestra aparte.` (siempre que
   haya compactaciones o diferencia con la referencia).

Los banners de parcial/truncado/no actualizado son de la capa; las notas del motor se muestran en
“Cómo se calcula” y, las críticas (parcial/tokens), también junto a los totales.

## 8. Trazabilidad con la spec

| FR | Entidad / regla |
|---|---|
| FR-001/005/006/038/039 | `TUseEfficiencyPanelResult`, overlay Radix, exclusión mutua (contracts/overlay) |
| FR-002 | `users` solo raíz; `sessions` raíz + subárbol |
| FR-003/048 | Sin escritura, export ni copia; solo `TSessionMessage[]` |
| FR-004 | `useSessionEfficiency` observa la caché de `sessions.messages`; sin fetch nuevo |
| FR-007 | `labels.ts` en español |
| FR-008/009/010/011/012/013/014 | §4 (score, cobertura, guardas, confianza) |
| FR-015/016/017 | `TFactor`, `TOmission`, “Cómo se calcula”, totals con coste/latencia |
| FR-018/019 | `null`/“no disponible”, omisión de indicadores, `weakSignals` |
| FR-020/021/022 | Sin comparación; determinismo; sin LLM |
| FR-023/024/025/026/027/028/029/030 | `TFinding`/`TEvidence`, ancla, catálogo, orden, señales, copy, recomendación, cita, recorte |
| FR-031/032/033/034/035 | `TTurnAnalysis`, tabla/tarjetas, expansión, orden, solo raíz |
| FR-036/037 | Estados del overlay y banner de datos previos |
| FR-040/041/042/043/044 | Contrato de overlay §accesibilidad/responsive |
| FR-045/046 | `TEfficiencyTotals`, `notes` |
| FR-047/049/050 | Alcance v1, sin puntuar estilo, sin culpa |
