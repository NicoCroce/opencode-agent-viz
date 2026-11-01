# Phase 0 — Research: Panel de eficiencia de sesión

**Feature**: `015-session-efficiency-panel` | **Date**: 2026-10-23 | **Plan**: [plan.md](./plan.md)

Insumo principal: [discovery/rfc.md](./discovery/rfc.md) (arquitectura y contrato de datos ya
decididos; no se reabren). Producto: [discovery/prd.md](./discovery/prd.md). La spec resolvió sus
dos preguntas en `Clarifications` (2026-10-23).

**Unknowns del Technical Context**: ninguno. **`NEEDS CLARIFICATION` abiertos: 0.**

Evidencia de repositorio verificada para este plan (no se re-diagnostica el problema):

- `src/Infrastructure/Components/GraphPane.tsx:113-135` — cabecera del grafo con `{n} agentes`,
  `SessionSummaryBar` y el botón `Seguir`; es el punto de entrada acordado, no el Inspector.
- `src/Infrastructure/Components/HistoryOverlay.tsx:45-63` y
  `src/Domains/History/Components/HistoryModal.tsx:88-125` — el histórico usa un `div
  role="dialog"` sin focus trap ni Radix; **no se copia** ese patrón (R1/R11).
- `src/Infrastructure/WorkspacePage.tsx:159-261` — posee `useHistory`, compone `HistoryOverlay` y
  pasa los slots a `WorkspaceView`; aquí vive la exclusión mutua y el mapa de sesiones.
- `src/Infrastructure/Components/WorkspaceView.tsx:7-34` y
  `src/Infrastructure/Components/WorkspaceLayout.tsx:77-129` — slots `history` renderizados en
  móvil y escritorio; el nuevo slot `efficiency` sigue el mismo patrón.
- `src/Infrastructure/Hooks/useHistoryOverlay.ts:45-49` — patrón de reset por cambio de raíz durante
  el render (se reutiliza en `useEfficiencyPanel`).
- `src/Infrastructure/Hooks/useWorkspaceEscape.ts:29-44` — listener global de `Escape`; debe
  suprimirse mientras el diálogo de eficiencia está abierto (R1).
- `src/Infrastructure/Services/session.service.ts:125-127` — `getSessionMessages` normaliza la
  respuesta; `src/Infrastructure/Services/message.entity.ts:17-29` define `TSessionMessage`
  (`info` + `parts`). `src/Infrastructure/Services/lib/messagePagination.ts:27` pide `order: 'asc'`.
- `src/Domains/queryKeys.ts:23` — `queryKeys.sessions.messages(id)` ya existe; **no se crea clave**.
- `src/Domains/Graph/lib/loadNodeContent.ts:17-27` — el enriquecimiento del grafo ya escribe
  `sessions.messages(id)` para cada nodo; abrir el panel no debe duplicar esa carga.
- `src/Domains/Inspector/InspectorMessages.service.ts:20-38` — patrón vigente de hook de mensajes
  (`useQuery` + `staleTime: Infinity` + identidad estable del array vacío).
- `src/Domains/Graph/lib/metrics/summarizeSession.ts:73-86` y
  `src/Infrastructure/Hooks/useWorkspaceSummary.ts:46-52` — `TSessionSummary.metrics` es un
  `TNodeMetrics` ya calculado por `summarizeSession`; se reutiliza como contraste, no se recalcula.
- `src/Domains/Graph/lib/metrics/latency.ts:61-66` — convención de duración de herramienta
  (`completed − (ran ?? created)`); `RES-6` la reutiliza.
- `src/Domains/Graph/lib/nodeStatus.ts:44-52` — `isActiveStatus` define los estados activos;
  `status: 'active'` del input se deriva de ahí.
- `src/Application/Components/Molecules/{SectionFrame,Disclosure,Metric,DetailRow,UnavailableValue}.tsx`
  — primitivas de estados, divulgación y datos ausentes que el panel reutiliza.
- `src/Application/Helpers/format/{clock,constants}.ts` y `formatCost/formatTokens/formatDuration/formatPercent`
  — formato consistente; el motor usa `formatClock` solo para la cita.
- `node_modules/@radix-ui/react-dialog` 1.1.23 (rango `^1.1.15` en `package.json`) ya está
  instalado; no hay dependencia nueva.

---

## R1 — Overlay, estado de vista y exclusión mutua

**Decisión**

- El panel es un **overlay full-screen** montado por Infrastructure como slot de `WorkspaceView`
  (`efficiency?: ReactNode`) y renderizado por `WorkspaceLayout` en móvil y escritorio, junto a
  `history`. No es una pestaña del Inspector (la spec 014 fija 7) ni una ruta nueva.
- Se usa **Radix Dialog** directamente (`DialogPrimitive.Root/Portal/Overlay/Content`) con
  `Dialog.Title`/`Description`, focus trap modal, cierre con `Escape`, scroll-lock y retorno de
  foco. No se usa el `div role="dialog"` de `HistoryModal` ni el `DialogContent` centrado de
  `ui/dialog.tsx` (que añade un cierre en inglés y un tamaño máximo).
- `useEfficiencyPanel({ rootSessionId, clock? })` posee el estado de vista:
  `{ isOpen, openedAt, open(trigger), close(), restoreFocus() }`.
  - `open(trigger)` guarda el elemento disparador y `openedAt = clock()`; `clock` es inyectable
    (por defecto `Date.now`) para tests.
  - `close()` solo cambia `isOpen`; el `onCloseAutoFocus` del diálogo llama a `restoreFocus()`, que
    devuelve el foco al disparador si sigue en el documento.
  - Un cambio de `rootSessionId` resetea el estado **durante el render** (patrón de
    `useHistoryOverlay`), cerrando el panel sin efectos en cascada.
- `WorkspacePage` compone la exclusión mutua: abrir eficiencia cierra el histórico; abrir el
  histórico cierra eficiencia. El histórico sigue siendo el único dueño de `useHistory`.
- `useWorkspaceEscape` gana un parámetro opcional `isDialogOpen`; con `true` no registra su listener
  global, de modo que `Escape` pertenece al diálogo y no limpia la selección del grafo por debajo.

**Rationale**

- Radix aporta foco atrapado, `Escape`, scroll-lock y `aria-modal` sin reimplementarlos; el
  histórico no los tiene y no es el patrón a copiar (FR-038/FR-039).
- El disparador está en `GraphPane`, fuera del árbol del `Dialog.Root`; Radix solo devuelve el foco
  a su propio `Trigger`, así que el retorno se hace explícito con el elemento guardado. Esto además
  es testeable sin depender del navegador.
- El estado en Infrastructure evita que `Domains/Efficiency` conozca el grafo o el histórico
  (Principio II) y permite que el overlay se monte siempre (Root cerrado) sin ejecutar el análisis.

**Alternativas consideradas**

- *8.ª pestaña del Inspector*: rompe la spec 014, sus specs y el E2E; el Inspector es de nodo.
  Rechazada por la decisión vinculante.
- *Página/ruta propia*: pierde el contexto del grafo y duplica data-fetching. Rechazada.
- *Copiar el `div role="dialog"` del histórico*: sin focus trap ni retorno de foco; incumple
  FR-038/FR-039. Rechazada.
- *Renderizar el overlay solo cuando `isOpen`*: Radix no ejecuta `onCloseAutoFocus` al desmontar el
  Root; el retorno de foco quedaría a cargo de un `setTimeout`. Se mantiene el Root montado y se
  monta el contenido solo cuando está abierto.
- *Guardar el disparador en un contexto del grafo*: acopla GraphPane al overlay; el callback
  `onOpenEfficiency(trigger)` es más simple y mantiene la presentación pura.

---

## R2 — Fuente de datos, caché y estados de carga

**Decisión**

- El motor consume `TSessionMessage[]` (`info` + `parts`), no `THistoryEntry`: la entrada del
  histórico no conserva tokens, modelo ni coste (decisión vinculante).
- `useSessionEfficiency({ rootSessionId, sessions, rootReady, truncated, graphError, now, enabled })`
  usa **`useQueries`** sobre `queryKeys.sessions.messages(id)` (clave existente) como **observador de
  caché**: cada entrada declara `queryFn: skipToken` y nunca se habilita, de modo que el observer solo
  se suscribe a la clave y refleja los `setQueryData` del enriquecimiento/eventos. **No hay fetch
  nuevo, ni clave nueva, ni endpoint nuevo.** El enriquecimiento del grafo (`loadNodeContent`) sigue
  siendo el único dueño de cargar los mensajes. El hook lee el dato del observer (o de
  `queryClient.getQueryData` con la misma clave) para distinguir `undefined` de `[]`.
- **Raíz**:
  - Sin caché y `rootReady === false` → `isLoading` (el grafo aún está cargando).
  - Sin caché y `rootReady === true` → `no_data` (la sesión no reportó mensajes).
  - Con caché → informe.
- **Subárbol**: solo se observan las sesiones con datos en caché; las que faltan se declaran
  **parciales** (`isPartial`, `missingSessionIds`) y no se inventan como vacías.
- **Error**: no hay consulta de red en el hook. `isError` lo aporta el grafo (`graphError`, p. ej.
  `graph.isError`); con un informe previo, el error no lo vacía: banner “no actualizado” y datos
  visibles (FR-037).
- El hook devuelve `{ report, isLoading, isError, isPartial, missingSessionIds }`:
  - `isLoading`: no hay informe y la raíz no está cacheada, `rootReady` es falso y no hay error.
  - `isError`: `graphError` sin informe.
  - `isPartial`: falta al menos una sesión del subárbol o `truncated` es true.
- **Memoización**: `useQueries` devuelve un array nuevo por render; se estabiliza con el patrón de
  `useStableGraphModel` (estado + comparación por referencias) y `analyzeSession` se memoriza por
  `[idsKey, referencias de mensajes, sessionsKey, now]`. `idsKey`/`sessionsKey` son cadenas
  ordenadas; `now` es el `openedAt` fijo del panel, no un reloj que tickea.

**Rationale**

- La caché existente cumple FR-004 (“sin acción de carga adicional”), respeta la decisión
  vinculante “sin fetch nuevo” y evita que abrir el panel con 200 nodos dispare 200 peticiones.
- La raíz ya está cargada cuando el grafo muestra datos (el enriquecimiento la prioriza); el panel
  no necesita pedirla. `rootReady` distingue “aún cargando” de “no hay mensajes” sin una consulta.
- El error de la sesión es el mismo que ya muestra el grafo; reutilizarlo evita una fuente de error
  duplicada y cumple “un fallo no vacía el veredicto” cuando hay datos previos.
- Distinguir `undefined` (no cargado) de `[]` (cargado y vacío) es imprescindible para no mostrar
  “sin datos” cuando en realidad falta el subárbol.

**Alternativas consideradas**

- *`useQueries` con fetch para la raíz o el subárbol*: contradice “sin fetch nuevo” y puede duplicar
  el trabajo del enriquecimiento. Rechazada.
- *Clave nueva `sessions.efficiency(id)`*: viola la decisión de reutilizar mensajes y duplica
  memoria. Rechazada.
- *Motor sobre el histórico paginado (`buildHistory`)*: pierde tokens/modelo/coste y obliga a
  paginar; rechazada por la decisión vinculante.
- *`useSyncExternalStore` sobre `queryClient`*: más código y menos idiomático que `useQueries`;
  rechazada.
- *Esperar a que el grafo esté 100 % enriquecido para abrir*: retrasa el panel y no aporta; el
  banner parcial ya declara lo que falta. Rechazada.

---

## R3 — Segmentación de turnos y atribución del subárbol

**Decisión**

- Un **turno** empieza en un mensaje `user` de la **raíz** (el input humano solo cuenta en la raíz;
  los `user` de subagentes son ejecución). Los pasos `assistant` y las herramientas de toda la
  raíz + subárbol se atribuyen al turno por **ventana temporal** `[user.created, cierre)`.
- Cierre de un turno:
  1. El primer `idle` de la raíz posterior al `user`, **si** el turno ya tiene al menos un paso
     `assistant`; el `idle` aporta `outcome`.
  2. El siguiente `user` de la raíz, si llega antes de un `idle`; el turno se marca
     `outcome: 'interrupted'` y `closed: true`.
  3. Si no hay ninguno, el turno es **abierto** (`closed: false`), se muestra marcado y queda fuera
     de todos los denominadores.
- Un `idle` sin pasos del turno actual se interpreta como la **cancelación del turno anterior**
  (el usuario interrumpió) y no cierra al turno nuevo; si es el primer turno y no hay pasos, se
  cierra como turno vacío con su `outcome`. Esto evita que la cancelación de U1 cierre
  prematuramente a U2.
- `TTurnAnalysis` expone: índice 1-based, `userMessageId`, `at`, `prompt` (completo), `promptTokens`,
  `closed`, `outcome`, `clarifications` (tools `question`/`form` de la raíz dentro de la ventana),
  `steps`, `toolCalls`, `toolErrors`, `retries`, `cost`, `durationMs` y `signals` (ruleIds).
- Los totales y las reglas de ejecución cuentan **todo** el subárbol; la entrada, el contexto y el
  resultado se miden en la **raíz** (ver R5/R8). La tabla muestra las señales del turno y marca el
  abierto.
- El turno abierto no entra en `closedTurns`, ni en los denominadores de INP-2, ni en la guarda de
  “<2 turnos”; su `durationMs` usa `now` (fijo al abrir) o queda `null`.

**Rationale**

- La spec fija el input humano solo en la raíz y exige no mezclar turnos de subagentes como pedidos
  humanos (FR-002/FR-035). La ventana temporal es la única atribución determinista sin heurísticas
  de contenido.
- El caso “usuario interrumpe mientras el agente ejecuta” es el que produce un `idle` de
  cancelación después del nuevo `user`; sin la regla del `idle` sin pasos, el turno nuevo se
  cerraría con el `outcome` del anterior y se falsearía el resultado.
- Excluir el turno abierto de denominadores es una decisión de producto vinculante.

**Alternativas consideradas**

- *Cada mensaje `assistant` como turno*: no representa un pedido humano; rechazada.
- *Segmentar por `idle` únicamente*: pierde las interrupciones sin `idle`; rechazada.
- *Atribuir subagentes por `parentID` al turno que los lanzó*: requiere resolver la cadena de
  invocaciones y no cubre herramientas tardías; la ventana temporal es más simple y suficiente
  para v1. Rechazada.
- *Reabrir un turno cerrado cuando llega un `idle` tardío*: produce resultados no deterministas y
  contradice “cerrado por el siguiente user”; rechazada.

---

## R4 — Texto, similitud y canonicalización

**Decisión**

- **Normalización**: `text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`.
- **Tokens**: split por `/[^\p{L}\p{N}]+/u`, filtrar vacíos. `tokenCount` = todos los tokens
  (longitud ≥ 1) para el umbral de 6; `similaritySet` = tokens con longitud ≥ 2 y sin stopwords
  es/en. Jaccard = `|A ∩ B| / |A ∪ B|`; si la unión es vacía, 0.
- **Longitud y recorte** en **code points**: `Array.from(text).length` y
  `Array.from(text).slice(0, 120).join('')`. No se corta un emoji por la mitad.
- **INP-1**: pares consecutivos de `user` de la raíz donde (a) el primer turno se cerró con `idle`
  (no por el siguiente `user`, para no duplicar con INP-2), (b) no hubo una herramienta de escritura
  entre ambos, (c) ambos prompts tienen `tokenCount ≥ 6` y (d) Jaccard de sus `similaritySet` ≥ 0,6.
  El denominador son los pares **elegibles** (consecutivos, sin escritura y con el primer turno
  cerrado con idle). Mínimo: 3 pares elegibles.
- **INP-3**: tools `question`/`form` de la raíz con texto extraíble; una llamada es “repetida” si
  su Jaccard con **alguna anterior** es ≥ 0,7. Se cuenta una vez por llamada; denominador = llamadas
  con texto.
- **Escritura de archivos**: nombres `write`, `edit`, `patch`, `apply_patch`, `multiedit`
  (case-insensitive). `bash` **no** se asume escritura. Ruta extraída de claves `filePath`,
  `filepath`, `path`, `file`, `filename` (búsqueda acotada, profundidad 4), normalizando `\` a `/`.
- **Canónico de herramienta**: serialización estable con claves ordenadas, profundidad ≤4, strings
  ≤256 code points, arrays ≤20 elementos, total ≤1 000; una sola vez por llamada. Firma =
  `name.toLowerCase() + '\0' + canonicalInput`. Salida canónica = texto de `state.content`
  acotado a 256; solo se compara si no está vacía.
- **Texto de pregunta**: claves `title`, `question`, `header`, `prompt` (profundidad ≤4),
  concatenadas; si no hay texto, la llamada no entra en la muestra de INP-3.

**Rationale**

- La similitud no debe depender de puntuación, acentos, mayúsculas ni stopwords; el idioma no se
  detecta ni se puntúa (FR-049). El umbral de 6 tokens evita que “sí”, “ok” o “dale” cuenten como
  reformulación.
- Contar code points evita que un emoji o un carácter compuesto se parta y que el test de longitud
  dependa de UTF-16.
- La canonicalización acotada evita `JSON.stringify` repetido o gigantes en herramientas con
  entradas grandes (R9).
- Excluir de INP-1 los pares interrumpidos evita penalizar dos veces el mismo comportamiento
  (reformulación + interrupción).

**Alternativas consideradas**

- *Levenshtein o embeddings*: coste y opacidad; los embeddings exigirían un modelo (prohibido).
  Rechazada.
- *Contar solo tokens de contenido para el mínimo de 6*: demasiado estricto con prompts cortos
  válidos; se usa el conteo total para longitud y el filtrado solo para Jaccard. Rechazada la
  alternativa de filtrar antes de contar.
- *Incluir `bash` como escritura*: falsos negativos de INP-1; rechazada.
- *Jaccard sobre multiconjuntos*: castiga repeticiones legítimas dentro del prompt; se usa conjunto.
  Rechazada la alternativa.
- *Reutilizar `candidateTitles` de History*: acopla Efficiency a History por una función de 20
  líneas; se replica el contrato de claves en `text.ts` con comentario. Rechazada la importación
  cross-domain.

---

## R5 — Composición de la puntuación

**Decisión**

Pesos de dimensión: **Entrada 30, Ejecución 30, Contexto 15, Resultado 25**. Pesos de indicador y
topes/mínimos:

| Dimensión | Indicador | Peso | Fórmula del aporte | Tope `cap` | Mínimo de muestra |
|---|---|---|---:|---:|---:|
| Entrada | INP-1 reformulación | 45 % | `1 − min(1, r/cap)` | 0,50 | 3 pares elegibles |
| Entrada | INP-2 interrupción | 35 % | `1 − min(1, r/cap)` | 0,33 | — |
| Entrada | INP-3 aclaración repetida | 20 % | `1 − min(1, r/cap)` | 1,00 | — |
| Ejecución | RES-1 tools fallidas | 45 % | `1 − min(1, r/cap)` | 0,20 | 10 llamadas **y** 5 pasos |
| Ejecución | RES-2 reintentos | 35 % | `1 − min(1, r/cap)` | 0,10 | — |
| Ejecución | RES-3 bucle/redundancia | 20 % | `1 − min(1, r/cap)` | 0,15 | — |
| Contexto | RES-4 presión | 70 % | `1 − min(1, max(0, n−1)/2)` | 2 (n−1) | — |
| Contexto | Caché (opcional) | 30 % | `min(1, hitRate/0,6)` | 0,60 | 10 pasos con tokens |
| Resultado | Outcome | 70 % | éxito 1 / interrumpido 0,5 / fallo 0 | 1 | outcome conocido |
| Resultado | Errores abiertos | 30 % | 1 sin error abierto / 0 con error | 1 | — |

- **INP-1 elegible**: par consecutivo de `user` de la raíz cuyo primer turno se cerró con `idle`
  (no por el siguiente `user`) y sin herramienta de escritura entre ambos. El denominador son los
  pares elegibles; el mínimo es 3.

- **Escala**: `score` del indicador ∈ [0,1]; `value` de dimensión ∈ [0,100] (float); `score` global
  es el entero final. `radio`/`ratio` es la proporción observada; `cap` el tope.
- **Excepción de caché**: es un indicador de calidad, no de fricción. Su aporte es
  `min(1, hitRate/0,6)` (no `1 − …`), tal como fija la tabla de la spec. `hitRate` =
  `Σ cache.read / Σ (cache.read + input)` de los pasos de la **raíz** con tokens.
- **Contexto**: RES-4 y caché se miden en la **raíz** (el contexto que persiste); `n` = compactaciones
  automáticas `completed` de la raíz. La primera no resta (`max(0, n−1)`). Contexto no exige mínimo
  de compactaciones (0 es válido). La caché se omite si no hay tokens, si hay <10 pasos con tokens
  o si el proveedor no da evidencia de caché (todas las lecturas y escrituras en 0); se declara. Un
  fallo de caché aislado no resta: con ≥10 pasos y una tasa ≥0,6 el aporte es 1; solo una tasa
  sostenidamente baja (<60 %) resta.
- **Ejecución**: RES-1/2/3 se miden sobre **todo el subárbol**. `r` de RES-1 = errores / llamadas;
  RES-2 = reintentos / pasos; RES-3 = llamadas redundantes / llamadas. `steps` = mensajes assistant.
  RES-1 exige ≥10 llamadas y ≥5 pasos; si no, la dimensión entera se omite.
- **Entrada**: `r` de INP-1 = pares similares / pares elegibles; INP-2 = turnos interrumpidos /
  turnos cerrados; INP-3 = preguntas repetidas / preguntas con texto. Entrada exige ≥3 pares
  elegibles; si no, se omite completa.
- **Resultado**: en la **raíz**, el último `idle` da el outcome. `openErrors` = el último assistant
  de la raíz tiene `error` o una tool en estado `error`, o el outcome es `failed`. Sin outcome
  conocido, la dimensión se omite (no se asume éxito).
- **Dimensión**: media ponderada de sus indicadores disponibles, renormalizada sobre los pesos
  disponibles. **Global**: media ponderada de las dimensiones disponibles, renormalizada sobre los
  pesos disponibles; `Math.round` al final.
- **Cobertura**: `Σ pesos de dimensiones disponibles − 4,5` si Contexto está disponible pero la
  caché opcional se omitió. Una dimensión omitida pierde su peso completo. No hay multiplicador por
  sesiones cargadas (R12).
- **Guardas**: `score = null` y `band = null` si la sesión está en curso, hay <2 turnos cerrados o
  la cobertura es <60 %. El informe sigue mostrando dimensiones, conteos y totales crudos. `no_data`
  si no hay ningún mensaje.
- **Bandas** (sobre el entero): 85–100 eficiente; 70–84 aceptable; 50–69 mejorable; 0–49 con
  fricción.
- **Precedencia de estado**: `no_data` → `in_progress` → `insufficient` → `ok`. `no_data` gana si
  no hay mensajes; `in_progress` si cualquier sesión del subárbol está activa (`isActiveStatus`).

**Rationale**

- Los valores son los de la spec y del RFC; el plan no los recalibra. La excepción de caché está
  escrita en la tabla de producto y es la única fórmula invertida.
- Renormalizar por dimensión y por global permite puntuar con datos parciales sin inventar ceros;
  la cobertura y el “cómo se calcula” hacen visible lo que falta (FR-010/FR-012/FR-016).
- Redondear una sola vez al final evita falsa precisión y bandas inconsistentes.
- Medir contexto/resultado en la raíz y ejecución en el subárbol separa atribución (el root es la
  conversación; el subárbol es la ejecución) y evita que un subagente contamine la nota de entrada.

**Alternativas consideradas**

- *Media simple de dimensiones*: pondera igual señales de distinta fiabilidad; rechazada por el RFC.
- *Score decimal*: falsa precisión; rechazada.
- *Penalizar la primera compactación*: contradice la spec y el edge case; rechazada.
- *Tratar caché ausente como 0*: penaliza a proveedores que no la reportan; rechazada.
- *Multiplicar la cobertura por sesiones cargadas*: contradice FR-010; rechazada (R12).
- *Contar compactaciones de todo el subárbol*: cada subagente tiene su propio contexto y su primera
  compactación no debería sumar presión a la raíz; se mide la raíz. Rechazada la alternativa.

---

## R6 — Catálogo de hallazgos, evidencia y orden

**Decisión**

Se emite **como máximo un hallazgo por regla** (agregando el conteo y usando la evidencia más
representativa), lo que mantiene el catálogo en 10 y cumple FR-025/FR-029. Cada hallazgo exige un
ancla `messageId` (y `toolId`/`formId` cuando aplique); sin ancla no se emite (FR-024). La cita
tiene el formato `[turno N · msg_… · tool … · hh:mm] "texto"`; el texto completo se guarda en
`quote` y la vista lo recorta a 120 code points en colapsado.

| ID | Condición medida | Dimensión | Severidad | ¿Resta? |
|---|---|---|---|---|
| INP-1 | Pares elegibles con Jaccard ≥0,6, ≥6 tokens, sin escritura; alta si ≥2 pares | Entrada | media/alta | Sí |
| INP-2 | Turno cerrado por `idle` interrumpido o por `user` durante la ejecución | Entrada | media | Sí |
| INP-3 | ≥2 preguntas/formularios de la raíz con Jaccard ≥0,7 | Entrada | media | Sí |
| INP-4 | Marcador de restricción tras la primera escritura + reedición del mismo archivo en ≤2 pasos | — | baja | No (débil) |
| RES-1 | `errores/llamadas ≥ 0,10` o `errores ≥ 3`; alta si ≥0,25 o contribuye al fallo | Ejecución | media/alta | Sí |
| RES-2 | `attempt ≥ 3` o `reintentos ≥ 3` | Ejecución | alta | Sí |
| RES-3 | ≥3 llamadas con la misma firma o ≥2 duplicados exactos con la misma salida | Ejecución | media | Sí |
| RES-4 | ≥2 compactaciones automáticas completadas (la primera no resta); 1 = señal débil | Contexto | baja | Sí (≥2) / No (1) |
| RES-5 | Coste >0 y outcome fallido/interrumpido (o fallido sin archivos) | — | media | No (débil) |
| RES-6 | p95 de duración de tools >60 s o ≥3 llamadas >60 s | — | baja | No (débil) |

- **INP-1**: una emisión agregada; evidencia = segundo `user` del par más representativo (el de
  mayor similitud). `condition` = “N de M pares consecutivos repitieron el pedido”.
- **INP-2**: una emisión; evidencia = el `idle` interrumpido o el `user` que interrumpió. Se cuenta
  como máximo una interrupción por turno.
- **INP-3**: una emisión; evidencia = la pregunta repetida más reciente.
- **INP-4**: una emisión; evidencia = el `user` con el marcador y la tool de reedición. Marcadores
  `no`, `sin`, `solo`, `sólo`, `debe`, `must`, `only` con límites de palabra sobre el texto
  normalizado.
- **RES-1**: evidencia = la tool fallida más representativa (ratio o la última). `condition` incluye
  `errores/llamadas` y el nombre de la tool.
- **RES-2**: evidencia = el assistant con el `attempt` máximo. La regla solo se emite con
  `attempt ≥ 3` o `≥3` reintentos; los reintentos menores puntúan por el indicador sin hallazgo.
- **RES-3**: evidencia = la primera llamada redundante (la segunda ocurrencia). Se deduplican por
  `toolId`.
- **RES-4**: con `n ≥ 2`, evidencia = la segunda compactación; con `n = 1`, señal débil
  (`penalizes: false`, `dimension: 'contexto'`) que no resta.
- **RES-5**: evidencia = el último `idle`/assistant con coste. No hay umbral en dólares.
- **RES-6**: evidencia = la tool más lenta. `p95` nearest-rank sobre duraciones completadas.
- **Orden**: `penalizes` (true primero) → severidad (alta > media > baja) → peso de dimensión
  (30/30/25/15/0) → `turnIndex` ascendente → `ruleId`. `findings` se limita a 10 (el catálogo
  produce ≤7); `weakSignals` va aparte y no consume ese cupo.
- **Copy**: lenguaje neutral y condicional (“posible fricción”, “señal”), recomendaciones
  específicas por regla (constantes en `labels.ts`/`rules.ts`), sin culpa ni satisfacción.

**Rationale**

- Una emisión por regla evita duplicar la misma causa y permite que la UI muestre “2–5 por impacto”
  con un `Disclosure` para el resto sin inventar paginación.
- La evidencia obligatoria es la defensa contra falsos positivos (FR-024/SC-004).
- El orden determinista hace que el mismo informe pinte igual y que los tests puedan afirmar
  `ruleId + severidad + rango de score` sin snapshots.

**Alternativas consideradas**

- *Una entrada por ocurrencia*: puede superar 10 y repite la misma condición; rechazada.
- *Ordenar por orden de aparición*: no prioriza impacto; rechazada.
- *Emitir RES-2 con cualquier reintento*: el catálogo exige ≥3; el indicador ya lo penaliza.
- *Omitir la señal de 1 compactación*: el edge case pide mostrarla como señal; se emite débil.
- *Citar sin mensaje (solo turno)*: no permite localizar; rechazada.

---

## R7 — Confianza determinista

**Decisión**

- `confidence = null` solo en `no_data`.
- `alta`: cobertura ≥85 % **y** todas las dimensiones disponibles con mínimo de muestra alcanzan el
  **doble** de ese mínimo: Entrada ≥6 pares elegibles; Ejecución ≥20 llamadas y ≥10 pasos; Contexto
  sin mínimo; Resultado basta con outcome conocido. Si el subárbol es parcial, nunca alta.
- `media`: cobertura ≥70 % y no alta.
- `baja`: cobertura <70 % o subárbol parcial.
- La regla se muestra literal en “Cómo se calcula”; nunca se concede alta con cobertura <85 %
  (FR-014/assumption).

**Rationale**

- Es una regla simple, determinista y explicable con dos variables que el usuario ya ve (cobertura
  y conteos). El doble del mínimo evita declarar alta con la muestra justa.
- El subárbol parcial baja la confianza aunque la cobertura de dimensiones sea alta, porque faltan
  datos que podrían cambiar los conteos (R12).

**Alternativas consideradas**

- *Confianza solo por cobertura*: ignora el tamaño de muestra; rechazada.
- *Fórmula estadística (intervalos)*: opaca y desproporcionada para v1; rechazada.
- *Alta con cobertura ≥80 %*: contradice la assumption de ≥85 %; rechazada.

---

## R8 — Totales, ventana, latencia y contraste con la cabecera

**Decisión**

- `totals` se deriva de los mensajes de **todo el subárbol**:
  - `cost`: suma de `assistant.cost` reportados; `null` si ninguno.
  - `tokensIn`/`tokensOut`: suma de `tokens.input`/`tokens.output`; `null` si no hay tokens.
  - `cacheRead`/`cacheWrite`: suma de `tokens.cache.read/write`; `null` si no hay tokens.
  - `compactions`: compactaciones `completed` (auto + manual); la dimensión Contexto cuenta solo
    las automáticas de la raíz.
  - `retries`: mensajes assistant con `retry`; `toolErrors`: tools en `state.status === 'error'`;
    `toolCalls`: tools totales.
  - **Aditivo**: `windowTokens` (último assistant **de la raíz** con tokens:
    `input + cache.read + cache.write`), `latencyP95Ms` y `slowToolCalls` (tools completadas;
    `completed − (ran ?? created)`, p95 nearest-rank y umbral 60 s).
- Los totales **no incluyen** el coste/tokens de las compactaciones (igual que
  `deriveMetricBase`/`summarizeSession`); la compactación se muestra aparte y se etiqueta la fuente.
- El panel recibe el `TSessionSummary` ya calculado por `useWorkspaceSummary` (que llama a
  `summarizeSession`) y usa `summary.metrics` (`TNodeMetrics`) como **contraste**: muestra la
  referencia de la cabecera solo si difiere de los totales derivados y explica la diferencia
  (compactación). No se vuelve a llamar a `summarizeSession` ni se monta `SessionSummaryBar` dentro
  del panel.
- `now` solo se usa para la duración del turno abierto; es el `openedAt` fijo del panel, no un tick.

**Rationale**

- Reutilizar el `TSessionSummary` existente cumple el mandato de no duplicar `summarizeSession` y
  `TNodeMetrics`, y el contraste explica la diferencia con `SessionInfo.tokens` (riesgo del RFC).
- La ventana y la latencia son contexto de lectura (FR-017/FR-045); exponerlas como números
  derivados evita duplicar `ContextSection`/`LatencySection`.
- La fuente “sin compactación” es la misma que la de la barra de resumen; etiquetarla evita que el
  usuario crea que los totales no cuadran.

**Alternativas consideradas**

- *Recalcular `summarizeSession` en el panel*: duplica coste y fuente; rechazada.
- *Incluir compactación en los totales*: rompe la comparabilidad con la cabecera y con
  `deriveMetricBase`; rechazada.
- *Usar `SessionInfo.tokens` como fuente*: incluye compactación y no es por paso; rechazada como
  fuente, aceptada como contraste si se muestra.
- *No exponer latencia hasta que haya un hallazgo RES-6*: incumple FR-017; rechazada.

---

## R9 — Rendimiento y memoización

**Decisión**

- Una sola pasada por los mensajes para construir `TFacts`: prompts de usuario, pasos assistant,
  tools (firma, salida, duración, ruta), retries, compactaciones, idles y errores. Las reglas y el
  score leen de `TFacts`; no hay una segunda pasada por regla.
- `analyzeSession` es puro y se memoiza por `[idsKey, referencias de mensajes, sessionsKey, now]`.
  Las referencias se estabilizan con un array en `useState` que solo cambia si cambia alguna
  referencia (patrón `useStableGraphModel`), no por un `JSON.stringify` del contenido.
- La canonicalización de herramientas se hace una vez por llamada y está acotada (R4).
- No hay reloj propio ni `setInterval`: `now` es `openedAt`; el análisis no tickea. El grafo
  conserva su reloj y su batching.
- El panel solo monta el contenido (y ejecuta el hook) cuando Radix abre; cerrarlo no deja trabajo
  en segundo plano.
- Objetivo SC-006: fixture de 200 mensajes; el test mide `performance.now()` alrededor de
  `analyzeSession` con un límite generoso de 1 000 ms (el motor real debe quedar muy por debajo).

**Rationale**

- El coste está dominado por el número de mensajes/tools, no por el número de reglas; una pasada
  mantiene el panel por debajo de 1 s y evita bloquear el hilo.
- Estabilizar por referencias es el patrón del repo y evita recomputar en cada render del workspace
  (SSE, resize, selección).
- No tickear es clave: un panel de análisis abierto en una sesión en curso no debe re-renderizar
  cada segundo.

**Alternativas consideradas**

- *`useMemo` con `JSON.stringify(messages)`*: O(n) extra y aloca strings; rechazada.
- *Web Worker*: complejidad y serialización; innecesario para 200 mensajes; rechazada.
- *Virtualizar la tabla*: v1 muestra 10 filas + “Ver N más”; sin virtualización (RFC). Rechazada.

---

## R10 — Integración, cableado y superficie congelada

**Decisión**

- `GraphPane` gana `onOpenEfficiency: (trigger: HTMLElement) => void` e `isMobile?: boolean`
  (por defecto `false`). El botón `Eficiencia` va **antes** de `Seguir`, `variant="outline"`,
  `aria-haspopup="dialog"`; en móvil es solo icono (`faChartLine`) con
  `aria-label="Abrir análisis de eficiencia"`. El texto visible en escritorio es `Eficiencia`. El
  botón se monta solo cuando `graph.graph.nodes.length > 0` (hay una sesión que analizar).
- `WorkspaceView` gana `efficiency?: ReactNode`; `WorkspaceLayout` lo renderiza en ambas
  presentaciones, junto a `history`. Solo uno puede estar abierto (R1).
- `WorkspacePage`:
  - `const efficiency = useEfficiencyPanel({ rootSessionId: rootId })`.
  - `const efficiencySessions = useMemo(() => buildEfficiencySessions(graph.graph), [graph.graph])`.
  - `handleOpenEfficiency(trigger)` cierra el histórico y abre eficiencia;
    `handleOpenHistory(sessionId)` cierra eficiencia y abre el histórico. Todos los
    `onOpenHistory` (grafo e inspector) usan el wrapper.
  - `useWorkspaceEscape({ ..., isDialogOpen: efficiency.isOpen })`.
  - Pasa a `EfficiencyOverlay`: `isOpen`, `rootSessionId`, `rootTitle`, `sessions`, `rootReady`,
    `truncated`, `graphError: graph.isError`, `now`, `reference: summary?.metrics ?? null`,
    `onClose`, `onRestoreFocus`.
- `buildEfficiencySessions(graph)` es una función pura de Infrastructure: `parentID` desde las
  aristas (`source` → `target`) y `status: 'active'|'idle'` desde `isActiveStatus(node.data.status)`.
- **Sin cambios**: `queryKeys`, `buildHistory`, `summarizeSession`, `TGraphNodeData`,
  `sameNodeData`, `InspectorPanel`/`InspectorSectionTabs`, las 7 pestañas de la spec 014 y el reducer
  de eventos. No hay ruta nueva ni `data-testid` público nuevo.
- Specs de Infrastructure: se actualizan los fixtures de `GraphPane` (nueva prop), `WorkspaceView`
  (slot), `WorkspaceLayout` (slot) y `WorkspacePage` (cableado); se añade un spec de integración de
  exclusión mutua y `Escape`.

**Rationale**

- La cabecera del grafo es la entrada acordada; no reabre la spec 014 ni el Inspector.
- El slot mantiene la presentación única (móvil/escritorio) y la exclusión mutua en un solo lugar
  (la página), como el histórico.
- La superficie congelada evita regresiones en grafo, historial, métricas y chat.

**Alternativas consideradas**

- *Botón en el Inspector*: reabre la 8.ª pestaña y la spec 014; rechazada.
- *Entrada desde el rail de sesiones*: fuera de alcance v1 (FR-047); rechazada.
- *Estado del overlay dentro del dominio Efficiency*: el dominio no debe conocer el histórico ni el
  layout; rechazada.
- *Un `useEffect` para cerrar al cambiar de raíz*: provoca un frame con datos viejos; se usa el
  patrón de reset en render. Rechazada.

---

## R11 — Accesibilidad, responsive y privacidad

**Decisión**

- **Diálogo**: Radix Dialog modal con `Dialog.Title` (“Eficiencia de la sesión”) y
  `Dialog.Description`; `role="dialog"`/`aria-modal` los aporta Radix. `Escape` cierra;
  `onCloseAutoFocus` devuelve el foco al disparador. Scroll-lock de Radix.
- **Foco**: focus trap; el primer foco va al botón “Cerrar” o al título; `Tab` cicla dentro. El
  disparador se guarda en `useEfficiencyPanel`.
- **Veredicto**: el número y la banda llevan `aria-label="{score} de 100, {banda}"`; el icono es
  decorativo (`aria-hidden`). La banda y la severidad se comunican con **texto + icono**, nunca solo
  color. Sin rojo en la banda; lenguaje neutral.
- **Tabla**: `<caption>` (visible o sr-only) y `scope="col"` en los encabezados; la fila expandida
  usa `aria-expanded`/`aria-controls` (solo cuando está abierta) y anuncia el estado. En móvil,
  `<article>` por turno con un botón de expansión equivalente.
- **Prompt**: recorte a 120 code points en colapsado; el texto completo se monta **solo** en la
  región expandida (render condicional, no CSS), nunca en tooltip ni en un botón de copia. No hay
  exportación ni `localStorage`.
- **Cifras**: ≥12 px (`text-xs` o superior); los totales usan `Metric`/`DetailRow`.
- **Responsive**: una sola fuente de lógica; `isMobile` elige tabla o tarjetas (no `md:hidden`). A
  320 px no hay scroll horizontal de página; las celdas usan `min-w-0`/`break-words`; los botones
  respetan el alto de control (≥24 px, recomendado 44 px).
- **Movimiento**: sin animaciones propias; se respeta `prefers-reduced-motion` (no hay count-up ni
  transiciones imprescindibles).
- **Temas**: solo tokens (`bg-surface-1`, `text-foreground`, `text-muted-foreground`, `border-border`,
  `bg-muted`); contraste 4.5:1 texto / 3:1 no textual en claro, oscuro y `forced-colors`. El foco
  usa el patrón del proyecto si se añade un control custom; los `Button` ya lo traen.
- **Privacidad**: solo lectura; prompts en memoria local; sin red adicional salvo la consulta de
  mensajes existente; sin telemetría ni envío a servidores.

**Rationale**

- Radix resuelve lo que el histórico no resolvía (focus trap/Escape/retorno) y cumple FR-038/039.
- El render condicional del prompt completo es la única forma de cumplir “completo solo en la
  región expandida” sin que el texto quede en el DOM colapsado.
- La tabla/cartas comparten los mismos datos y la misma lógica; solo cambia la presentación
  (AGENTS §9).

**Alternativas consideradas**

- *`line-clamp` para el prompt*: el texto completo queda en el DOM y en el lector de pantalla;
  rechazada.
- *Tooltip con el prompt completo*: prohibido por FR-030; rechazada.
- *Tabla con scroll horizontal en móvil*: prohibido por FR-034/FR-044; se usan tarjetas.
- *Animación de count-up del score*: no aporta y molesta con movimiento reducido; rechazada.

---

## R12 — Subárbol parcial y cobertura (conflicto resuelto)

**Decisión**

- La **cobertura** es exactamente la suma de pesos de dimensiones disponibles menos la parte de la
  caché opcional omitida (FR-010). No se multiplica por sesiones cargadas ni se resta un porcentaje
  arbitrario.
- Un subárbol parcial (faltan mensajes de nodos que el grafo aún no cargó, o el grafo está truncado)
  se declara en `notes`, en un banner `role="status"` y fuerza `confidence: 'baja'`. La cobertura
  baja **solo** si la falta de datos impide alcanzar el mínimo de una dimensión (p. ej., sin tools
  de un subagente no se llega a 10 llamadas → Ejecución se omite y pierde 30).
- No se inventan ceros: una sesión sin datos no aporta mensajes; un indicador sin denominador se
  omite; un total sin datos es `null`/“no disponible”.

**Rationale**

- El edge case de la spec pide “reducir la cobertura”, pero FR-010 y la decisión de puntuación la
  definen como peso de dimensiones. Multiplicarla por completitud haría que la cobertura mostrada no
  cuadrara con la suma de pesos y con la guarda del 60 %, y mezclaría dos conceptos (disponibilidad
  de dimensiones vs. completitud de la carga). La reducción natural por mínimos + confianza baja +
  banner + nota hace visible la limitación sin romper el contrato.
- La alternativa de un campo `dataCompleteness` separado se descarta para no ampliar la UI ni el
  contrato en v1; la confianza y las notas ya lo comunican.

**Alternativas consideradas**

- *`coverage *= loaded/total`*: contradice FR-010; rechazada.
- *Omitir siempre Ejecución si falta cualquier sesión*: demasiado agresivo y pierde señal de las
  sesiones cargadas; rechazada.
- *Mostrar 0 en los totales faltantes*: viola FR-018/SC-008; rechazada.
- *Campo `dataCompleteness` en el informe*: contrato nuevo no pedido; se pospone a una calibración
  futura. Rechazada para v1.

---

## Re-evaluación post-diseño

| Principio | Verificación post-diseño | Veredicto |
|---|---|---|
| I | Solo lectura; sin SDK de escritura, export ni copia | PASS |
| II | Dominio Efficiency aislado; composición en Infrastructure; sin imports cross-domain desde componentes | PASS |
| III | Sin SDK: el hook observa la caché de `sessions.messages(id)` con `useQueries`; sin claves ni fetch nuevos | PASS |
| IV | `TSessionMessage` y `T...`; sin redefinir SDK | PASS |
| V | `lib/` puro, sin React/estado/reloj/aleatoriedad; specs por regla y umbral | PASS |
| VI | Overlay error → carga → vacío → datos; bloques con vacío explícito; datos previos + banner en fallo de actualización | PASS |
| VII | Una pasada memoizada; sin tick; sin fetch; grafo intacto | PASS |
| VIII | Specs junto al código; constantes; sin magia; Conventional Commits | PASS |

**`NEEDS CLARIFICATION` restantes: 0.** La calibración de umbrales/bandas con dogfooding sigue como
supuesto de producto (no cambia el contrato); no bloquea la implementación.
