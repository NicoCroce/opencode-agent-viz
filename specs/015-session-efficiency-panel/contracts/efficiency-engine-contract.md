# Contrato — Motor de eficiencia de sesión

**Feature**: `015-session-efficiency-panel` | **Fecha**: 2026-10-23
**Plan**: [../plan.md](../plan.md) · **Modelo**: [../data-model.md](../data-model.md)

Este contrato fija la API pura de `src/Domains/Efficiency/lib/analyzeSession.ts` y de sus módulos
auxiliares. Es la fuente de verdad para implementación y tests. Cualquier cambio de forma o de
fórmula exige actualizar este archivo y el modelo de datos.

## 1. Alcance y pureza

- Analiza **una** sesión raíz y todo su subárbol. No compara sesiones, no hace ranking ni
  percentiles (FR-020).
- No usa SDK, React, red, `localStorage`, `Date.now()`, `Math.random()`, `crypto` ni servicios
  externos. El reloj entra por `now` (FR-021/FR-022).
- No escribe ni muta la entrada; devuelve un objeto nuevo e inmutable por convención.
- UI en español: el motor produce copy neutral (`condition`, `quote`, `notes`); las etiquetas de
  presentación viven en `labels.ts`.

## 2. Entrada

```ts
analyzeSession(input: TEfficiencyInput): TEfficiencyReport
```

`TEfficiencyInput` (ver `data-model.md` §1.1):

- `rootSessionId: string`.
- `messagesBySession: Record<string, TSessionMessage[]>`; una clave ausente = sesión no cargada.
- `sessions: Record<string, { parentID?: string; status?: 'active' | 'idle' }>`.
- `truncated?: boolean`; el grafo declara el subárbol incompleto (parcial para la confianza).
- `now?: number`; solo para la duración del turno abierto.

Reglas de lectura:

- Los mensajes se leen por `info.type` (`user`, `assistant`, `idle`, `compaction`, `shell`, …) y por
  `parts` (`text`, `reasoning`, `tool`).
- Tokens por paso: `info.tokens` del assistant; **no** se acumulan para la ventana (la ventana es
  `input + cache.read + cache.write` del último assistant de la raíz con tokens).
- Input humano: solo `user` de la raíz. Los `user` de subagentes no son entrada.
- Tools: `parts.filter(p => p.type === 'tool')`; estado en `p.state.status`; duración
  `p.time.completed − (p.time.ran ?? p.time.created)` si ambos existen.
- Compactaciones: `info.type === 'compaction'` con `status === 'completed'`; `reason === 'auto'`
  para RES-4. Las de la raíz son las que puntúan en Contexto.
- Outcome: último `idle` de la raíz.
- `truncated` no altera la lectura de mensajes: solo marca el análisis como parcial para la
  confianza (§5.3).
- Un mensaje sin `time.created` no se usa para ordenar; se ignora para ventanas (no debería ocurrir
  en el SDK).

## 3. Salida

`TEfficiencyReport` (ver `data-model.md` §2.2). Campos obligatorios: `status`, `score`, `band`,
`coverage`, `confidence`, `dimensions`, `findings`, `weakSignals`, `turns`, `totals`, `notes`.

**Adiciones aditivas al RFC** (documentadas; no rompen consumidores):

- `TFinding.condition: string` (la FR-023 exige la condición medida; el tipo del RFC solo la
  mencionaba en el catálogo).
- `totals.windowTokens: number | null`.
- `totals.latencyP95Ms: number | null`.
- `totals.slowToolCalls: number`.
- `TTurnAnalysis` se especifica en `data-model.md` §2.5 (el RFC solo lo nombraba).
- `TFactor` y `TOmission` son tipos de vista derivados; no forman parte del informe del motor.

## 4. Segmentación e invariantes de datos

1. **Turno**: `user` de la raíz + pasos `assistant` y tools de raíz + subárbol en la ventana
   `[user.time.created, cierre)`.
2. **Cierre**: primer `idle` con ≥1 paso del turno, o siguiente `user` (interrupción). Sin cierre =
   abierto; el abierto no entra en denominadores.
3. **Idle sin pasos**: se atribuye a la cancelación del turno anterior si este se cerró por el
   `user` actual; no cierra el turno nuevo. Si es el primer turno, lo cierra vacío.
4. **Sin reapertura**: un turno cerrado no se reabre con un `idle` tardío.
5. **Fuera de turno**: los mensajes anteriores al primer `user` o posteriores al último cierre
   cuentan en totales, no en métricas de turno.
6. **Subárbol parcial**: `sessions` sin clave en `messagesBySession` se declara; no se inventan
   mensajes ni ceros.
7. **Estado**: `no_data` si no hay ningún mensaje; `in_progress` si cualquier `sessions[id].status ===
   'active'`; `insufficient` si `closedTurns < 2` o `coverage < 60`; si no, `ok`.

## 5. Puntuación

### 5.1 Pesos y topes

| Dimensión (peso) | Indicador (peso) | `r` | `cap` | Mínimo |
|---|---|---|---:|---:|
| Entrada (30) | INP-1 (45 %) | pares similares / pares elegibles | 0,50 | 3 pares |
| Entrada | INP-2 (35 %) | turnos interrumpidos / turnos cerrados | 0,33 | — |
| Entrada | INP-3 (20 %) | preguntas repetidas / preguntas con texto | 1,00 | — |
| Ejecución (30) | RES-1 (45 %) | toolErrors / toolCalls | 0,20 | 10 calls y 5 pasos |
| Ejecución | RES-2 (35 %) | retries / steps | 0,10 | — |
| Ejecución | RES-3 (20 %) | redundantCalls / toolCalls | 0,15 | — |
| Contexto (15) | RES-4 (70 %) | `max(0, n−1)` | 2 | — |
| Contexto | CACHE (30 %) | hitRate | 0,60 | 10 pasos con tokens |
| Resultado (25) | OUTCOME (70 %) | `1 − valor` | 1 | outcome conocido |
| Resultado | OPEN_ERRORS (30 %) | `1` si error abierto | 1 | — |

- Fricción: `score = 1 − min(1, r / cap)`.
- Caché: `score = min(1, hitRate / 0,6)` (indicador de calidad, no de fricción).
- `hitRate = Σ cache.read / Σ (cache.read + input)` sobre pasos de la **raíz** con tokens.
- `RES-4`: `n` = compactaciones automáticas `completed` de la raíz; la primera no resta.
- `OUTCOME`: `succeeded` 1, `interrupted` 0,5, `failed` 0; `ratio = 1 − valor`.
- `OPEN_ERRORS`: 1 si el último assistant de la raíz tiene `error`/tool en error o el outcome es
  `failed`; `ratio = 1 − score`.
- Caché omitida si: no hay tokens, <10 pasos con tokens, o todas las lecturas/escrituras son 0
  (proveedor sin caché). Se declara en `notes`.

### 5.2 Composición

- `value` de dimensión = `100 × Σ(peso_i × score_i) / Σ(peso_i)` sobre indicadores disponibles.
- Si el mínimo de la dimensión no se alcanza, `available = false`, `value = null`, y se pierde su
  peso completo. Entrada: INP-1; Ejecución: RES-1 (10 calls y 5 pasos); Resultado: outcome
  conocido. Contexto no exige mínimo de compactaciones.
- `score` global = `Math.round(Σ(peso_d × value_d) / Σ(peso_d))` sobre dimensiones disponibles,
  acotado a [0,100].
- `band`: 85–100 eficiente; 70–84 aceptable; 50–69 mejorable; 0–49 fricción.

### 5.3 Cobertura y confianza

```text
coverage = Σ peso_d(disponible) − (contexto disponible && caché omitida ? 4,5 : 0)
```

- Confianza:
  - `null` si `no_data`.
  - `alta` si `coverage >= 85`, todas las dimensiones disponibles con mínimo de muestra alcanzan el
    doble (Entrada ≥6 pares; Ejecución ≥20 calls y ≥10 pasos; Contexto sin mínimo; Resultado basta
    con outcome conocido) y el subárbol no es parcial (`missingSessionIds` vacío y
    `truncated !== true`).
  - `media` si `coverage >= 70` y no alta.
  - `baja` si `coverage < 70` o el subárbol es parcial (`missingSessionIds` no vacío o
    `truncated === true`).
- Guardas: `score = null` y `band = null` si `in_progress`, `insufficient` o `no_data`. La cobertura
  y las dimensiones se siguen reportando cuando hay datos.

## 6. Catálogo de hallazgos

Ver `data-model.md` §2.6 y la tabla de `research.md` R6. Reglas de emisión:

1. **Una emisión por regla** (agregando conteo; evidencia más representativa). Máximo 10
   penalizantes; el catálogo produce ≤7. `weakSignals` va aparte.
2. **Ancla obligatoria**: `evidence.messageId` no vacío; `toolId`/`formId` cuando aplique. Sin ancla,
   la regla no emite (FR-024).
3. **Cita**: `[turno N · msg_… · tool … · hh:mm] "texto"`. `hh:mm` con `formatClock` (hora local,
   determinista en el mismo entorno). El texto completo va en `quote`; la vista recorta.
4. **Condición**: string medido y neutral, p. ej. “2 de 3 pares consecutivos con similitud ≥ 0,6”.
5. **Recomendación**: específica de la condición; constantes en `rules.ts`/`labels.ts`.
6. **Severidad**:
   - INP-1 media, alta si ≥2 pares.
   - INP-2 media.
   - INP-3 media.
   - INP-4 baja (débil).
   - RES-1 media, alta si `r >= 0,25` o contribuye al fallo.
   - RES-2 alta (solo se emite con `attempt >= 3` o `retries >= 3`).
   - RES-3 media.
   - RES-4 baja (n≥2); con n=1, señal débil (`penalizes: false`).
   - RES-5 media (débil).
   - RES-6 baja (débil).
7. **RES-5**: coste >0 y outcome `failed`/`interrupted`, o coste >0, 0 archivos y `failed`; sin
   umbrales de dólares.
8. **RES-6**: p95 nearest-rank de tools completadas >60 s o ≥3 tools >60 s; evidencia = la más
   lenta.

**Orden**: `penalizes` (true primero) → severidad (alta > media > baja) → peso de dimensión
(30/30/25/15/0) → `turnIndex` ascendente → `ruleId` ascendente. `findings` se corta a 10;
`weakSignals` no consume ese cupo (se corta a 10 por seguridad).

## 7. Totales

- `cost`, `tokensIn`, `tokensOut`, `cacheRead`, `cacheWrite`: suma de assistant de **todo el
  subárbol**; `null` si no se reportó ninguno. No incluyen compactación.
- `compactions`: `completed` auto + manual; `retries`: assistant con `retry`; `toolErrors`: tools en
  error; `toolCalls`: tools totales.
- `windowTokens`: raíz, último assistant con tokens.
- `latencyP95Ms`/`slowToolCalls`: tools completadas del subárbol.
- Fuente: “derivado de mensajes; no incluye compactación”. El contraste con
  `summarizeSession`/`TNodeMetrics` es responsabilidad de la capa (R8), no del motor.

## 8. Notas

Orden y condiciones en `data-model.md` §7. El motor no conoce el truncamiento del grafo ni el estado
de la caché de React; esas notas las añade la capa (Infrastructure) al renderizar. El motor sí
añade la nota de subárbol parcial (comparando `sessions` con `messagesBySession`).

## 9. Determinismo y rendimiento

- Misma entrada → mismo `JSON.stringify(report)` (salvo el orden de claves, que es estable por
  construcción). Sin `Date.now`, `Math.random` ni orden dependiente de `Object.keys` no ordenado:
  todo array de salida se ordena explícitamente.
- Una sola pasada para `TFacts`; las reglas y el score leen de ahí. La canonicalización de tools se
  hace una vez por llamada y está acotada.
- Objetivo: 200 mensajes en <1 s; el test de rendimiento usa `performance.now()` alrededor de
  `analyzeSession` con un límite de 1 000 ms.
- Complejidad esperada: O(M + T log T) por el orden de duraciones para p95, con M = mensajes y
  T = tools.

## 10. Obligaciones de test

- **Turns**: turno normal, interrumpido por user, idle de cancelación, turno abierto, múltiples
  turnos, pasos de subagente atribuidos por tiempo, user de subagente ignorado.
- **Texto**: acentos/mayúsculas, stopwords, emoji/code points, Jaccard 0,59/0,60/0,61, token count
  5/6/7, canonicalización estable, extracción de ruta.
- **Reglas**: tabla por regla positivo/negativo, umbral−1/umbral/umbral+1, sin ancla → no emite,
  severidad alta, señales débiles, cap 10.
- **Score**: cada dimensión disponible/omitida, caché omitida, outcome 1/0,5/0, cobertura 59/60,
  bandas 49/50, 69/70, 84/85, redondeo, confianza alta/media/baja/parcial.
- **Informe**: sesión limpia, con fricción, en curso, <2 turnos, sin datos, subárbol parcial;
  determinismo (dos ejecuciones); totales coincidentes con `summarizeSession` en una sesión de un
  nodo.
- **Factores/omisiones**: 2–3 factores, orden por impacto, fallback positivo, motivos de omisión.

## 11. Superficie congelada

- No se modifican `queryKeys`, `buildHistory`, `summarizeSession`, `TGraphNodeData`, `sameNodeData`
  ni la spec 014.
- El motor no importa `@opencode/client`, `@app/Infrastructure/*` ni `react`.
- Los únicos cambios de contrato son **aditivos** (§3) y se reflejan en `data-model.md`.
