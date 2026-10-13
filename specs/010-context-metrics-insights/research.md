# Research — Context Composition, Parallel Speedup & Latency Insights

**Feature**: `010-context-metrics-insights`
**Date**: 2026-10-12
**Input**: [spec.md](./spec.md)

Decisiones de recon resueltas antes del diseño. Todas son de **solo lectura** sobre datos ya presentes en el cliente (Principio I): no se añade instrumentación al servidor ni se cambia el stream.

---

## R1 — Semántica de "contexto" del agente

**Decision**: El "contexto" de un agente es la **ventana del último paso**: los tokens del prompt efectivamente enviado en su última respuesta assistant (`input + cache.read + cache.write` del último mensaje assistant con `tokens`). La composición (§R2) se calcula sobre esa ventana.

**Rationale**: La composición responde "¿de qué está hecho el contexto que el modelo vio?". Sumar los `input` de todos los pasos contaría el mismo contexto varias veces (cada paso reenvía el prompt acumulado). `TTokenUsage` del nodo es un **acumulado** (`accumulateTokens` suma por mensaje), por lo que **no sirve** para la ventana; hace falta derivar del último mensaje.

**Alternatives considered**:
- Suma de `input` de todos los pasos → mide tokens *procesados* (coste), no la ventana; infla y no representa "composición del contexto".
- `input` del primer paso → ignora el crecimiento; subestima.

**Impacto**: `deriveContextBreakdown` necesita recorrer mensajes (no reutiliza el `TTokenUsage` acumulado). La ventana y el acumulado coexisten: el acumulado sigue alimentando lo ya existente.

---

## R2 — Atribución de tokens por categoría

**Decision**: Repartir los **tokens reales de la ventana** (R1) proporcionalmente al **peso de caracteres** de cada categoría. `tokensCategoría = round(windowTokens × charsCategoría / charsTotales)`. Si no hay ventana medible (`windowTokens === null`), `tokens = null` y se muestra solo el peso relativo.

**Rationale**: OpenCode no expone tokens por parte ni por herramienta (`SessionStatsToolUsage` solo trae `calls`/`succeeded`/`failed`/`durationP50`). Repartir sobre el total real evita el error acumulado de estimar tokens por categoría de forma independiente y garantiza que los porcentajes sumen 100% (SC-002).

**Alternatives considered**:
- `chars / 4` por categoría → error acumulado; los porcentajes no cierran sobre el total real.
- Mostrar solo caracteres → pierde la lectura en tokens que el usuario pidió ("resultados de herramientas 47%").

**Categorías**: `toolResult` (texto de `state.content`), `toolInput` (`JSON.stringify(state.input)`, más el `input` textual mientras `status === 'streaming'`), `reasoning` (partes `reasoning`), `assistantText` (partes `text`), `userText` (`SessionMessageUser.text`).

---

## R3 — Dónde y cuándo se calcula (rendimiento)

**Decision**: La composición, la ventana y la latencia se derivan **durante el enriquecimiento del nodo** (`enrichNodeData`), junto a `deriveMetricBase`, y se guardan en campos **opcionales** del nodo. Son funciones puras **memoizables por identidad de `messages`**.

**Rationale**: El enriquecimiento ya carga los mensajes de cada nodo y ya es el punto donde se fusionan las métricas. Derivar sobre `messages` (una vez por lote, memoizado) mantiene el coste O(mensajes) acotado y no añade trabajo por tick. Calcularlo en el render sería O(mensajes) por frame (viola Principio VII).

**Alternatives considered**:
- Derivar en el componente/hook de render → recómputo por tick y por selección; prohibido por AGENTS §4 y Principio VII.
- Precargar todos los nodos → el plan de enriquecimiento ya carga en prioridad (`buildEnrichmentPlan`); se respeta.

**Impacto**: `enrichNodeData` añade `context` (y deja `speedup` a una pasada posterior del modelo). Los campos nuevos **deben entrar en `sameNodeData`** (ver R8), o el nodo no se reemplaza y el valor queda congelado.

---

## R4 — Aceleración por paralelismo

**Decision**: Por grupo de paralelismo (`deriveParallelGroups`, ya existente):
`serialMs = Σ duración(miembro)`, `wallMs = endedAt − startedAt` del grupo, `speedup = serialMs / wallMs`, `efficiency = speedup / size`. Global de sesión: `serialMs = Σ duración(todos los nodos)`, `wallMs = longitud de la unión de los intervalos` de todos los nodos, `speedup = serialMs / wallMs`.

**Rationale**: Es la definición estándar de *speedup* (tiempo serie / tiempo real). El grupo ya agrupa hermanos solapados; la unión de intervalos para el global evita contar dos veces el tiempo compartido. Reutiliza `executionInterval`/`nodeInterval` (Principio V).

**Alternatives considered**:
- Speedup = tamaño del grupo → es el ideal, no el real; ignora solape parcial.
- Medir por niveles de ejecución → los niveles son tandas de layout, no ventanas de solape.

**Provisional**: si algún miembro está activo (`isActiveStatus`), `provisional = true` y las duraciones abiertas se cierran en `now` (mismo criterio que `summarizeSession`).

---

## R5 — Impacto en el contexto del padre

**Decision**: El aporte de un hijo al padre se mide localizando, en los mensajes del padre, el tool part de spawn (`name ∈ {subagent, task}`, ya definido en `deriveTasks`) cuyo `state.metadata.sessionID === childSessionId`; el aporte son los caracteres de su `state.content` y su proporción `addedChars / charsTotalesDelPadre`, más `addedTokens = round(windowTokensDelPadre × proporción)`.

**Rationale**: El resultado del hijo entra al contexto del padre como resultado de ese tool (es el único canal). La proporción sobre el total del padre responde directamente "cómo impactó en el contexto del padre". Reutiliza el vínculo `metadata.sessionID` que `deriveTasks` ya explota.

**Alternatives considered**:
- Usar el `output` del hijo → no refleja lo que realmente quedó en el padre (puede truncarse).
- Diferencia de `input` del padre antes/después → no aislable con los datos disponibles.

**Dependencia**: requiere los **mensajes del padre**, que pueden no estar cargados. Se calcula **bajo demanda** en el hook del Inspector (que ya carga mensajes por nodo) y no en el modelo del grafo. Si el padre no está cargado o no se halla el tool, `null` → "no disponible".

---

## R6 — Velocidad de respuesta

**Decision**: Por respuesta assistant: `ttftMs = time.streamed − time.created` (tiempo hasta el primer token) y `totalMs = time.completed − time.created` (latencia total). Serie temporal por nodo, en orden de `time.created`. La referencia es la **mediana** de los `totalMs` del nodo; si el nodo tiene menos de `MIN_SAMPLES = 3` muestras, se usa la mediana del **mismo agente**.

**Rationale**: `streamed`/`completed` ya están en `SessionAssistantMessage.time`. La mediana es robusta ante valores atípicos (SC-006). El mínimo de muestras evita marcar anomalías sin baseline.

**Alternatives considered**:
- Media → sensible a outliers, que son justo lo que se quiere detectar.
- Comparar solo con el paso anterior → ruidoso y sin robustez (el usuario aceptó generalizar a mediana histórica).

---

## R7 — Umbral y dirección de la anomalía

**Decision**: Anomalía si `totalMs / referencia` se sale de `[1 − threshold, 1 + threshold]`. `direction = 'slow'` si por encima, `'fast'` si por debajo. Umbral por defecto **0.4 (±40%)**, **configurable** y persistido en `localStorage` (mismo patrón que el ancho del panel en 008). La rapidez anómala se marca explícitamente (SC-006).

**Rationale**: El usuario pidió alertar cuando la respuesta se **reduce**; una caída fuerte suele indicar respuesta truncada/error. La banda bidireccional cubre ambas degradaciones. Persistir en `localStorage` mantiene la feature de solo lectura respecto del servidor (Principio I).

**Alternatives considered**:
- z-score → requiere varianza estable; con pocas muestras es frágil.
- Umbral fijo no configurable → el usuario pidió ver la variación; la sensibilidad depende del caso.

---

## R8 — Contrato de datos del nodo

**Decision**: Se **añaden** a `TGraphNodeData` campos **opcionales**: `context?: TNodeContextMetrics | null` y `speedup?: TNodeSpeedup | null`. Ambos entran en `sameNodeData` mediante comparadores nuevos (`sameContext`, `sameSpeedup`). `TNodeMetrics` **no cambia de forma**.

**Rationale**: AGENTS §11 y el contrato de render: un campo nuevo de nodo es invisible si no se actualiza el comparador de reconciliación. Mantenerlo opcional respeta la inicialización del modelo estructural (igual que `effort?` en 008).

**Alternatives considered**:
- Extender `TNodeMetrics` → rompe `sameMetrics` y la paridad de negocio (FR-007); mayor riesgo.
- Guardar en estado global → fuera del modelo reconciliado; no se re-renderiza.

---

## R9 — Ubicación en la UI

**Decision**:
- **Nodo** (`AgentNodeFooter` / banda nueva): contexto `in → out` compacto, badge de aceleración (`×N`) cuando participa de un grupo y marca de anomalía de latencia.
- **Detalle** (`Inspector`): nueva sección **Contexto** con composición, ventana/caché, evolución, salida, compactaciones, aporte al padre y serie de latencia; y sección **Paralelismo** con el desglose del grupo.
- **Resumen de sesión** (`SessionSummaryBar`): métrica global de aceleración.

**Rationale**: El usuario pidió in/out en el nodo, el conjunto completo en el detalle y una cifra global; separa la lectura de un vistazo (nodo/barra) del análisis (detalle).

---

## R10 — Accesibilidad y presentación

**Decision**: La composición es una **barra apilada con leyenda y valores textuales** (no solo color); la anomalía lleva **etiqueta textual** ("Respuesta lenta/rápida") además del color; la navegación al padre es un control operable por teclado. Se respeta `prefers-reduced-motion`. Mobile reutiliza el patrón de doble presentación (`useDevice`).

**Rationale**: Principio VI y AGENTS §9; la información no puede depender solo del color (a11y).
