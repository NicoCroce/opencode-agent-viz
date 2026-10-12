# Optimización del contexto y del paralelismo (etapas A y B)

Este documento recoge **por qué** se cambió SddOrch, **qué** se cambió en cada etapa, **qué se descartó** y **cómo medir** si funcionó. Es la referencia de las decisiones; el funcionamiento día a día está en [Fases](02-phases.md), [Subagentes](04-subagents.md), [Planificación de tandas](05-scheduling.md) y [Memoria](07-memory.md).

> **Estado:** los cambios están aplicados pero **aún no medidos en una ejecución real**. Las cifras de reducción son una **simulación sobre datos reales** de la feature 009, no una medición posterior. Ver [Cómo medir](#cómo-medir-la-próxima-ejecución).

## 1. Punto de partida

Se analizaron, en solo lectura, dos ejecuciones del orquestador `sddorch` guardadas en la base de datos de OpenCode:

- la feature **008** (`ses_ee11c539…`),
- la feature **009** más 4 iteraciones de UX (`ses_ed8a1bdd…`), con unos 152 subagentes hijos.

Objetivos del usuario, por orden de prioridad: **reducir el contexto del orquestador**, evitar cuelgues, mantener y mejorar la paralelización, y optimizar el proceso.

### 1.1 Hallazgos

| Área | Hallazgo | Evidencia |
|---|---|---|
| Contexto | El orquestador llegó a 305K (008) y 470K (009) sin compactar. El límite del modelo es 1M, así que nunca se compactó. | Sesiones 008 y 009 |
| Contexto | El *reasoning* del modelo se reenvía en cada paso y supone ~26% del contexto. | Sesión 009 |
| Latencia | Con más contexto, cada token tarda más: 13 ms/token por debajo de 100K, 52 ms/token por encima de 400K. | Sesión 009 |
| Dónde se gasta | `specify` + `clarify` + constitución + PRD/RFC suman +68K, más que `implement` (+75K). | Fase a fase, 009 |
| Retornos de hijos | Lo que devuelven los subagentes se acumula: 31,5K en una feature, 58K en la sesión. | 009 |
| Iteraciones | Cada iteración tras el `release` suma 40–70K y solo la contienen la compactación o una sesión nueva. | 009 |
| Permisos | El 24% de los pasos de `release` se pierde por comandos compuestos (`&&`, `;`, `\|`, `echo`) y por `git fetch`, `merge-base`, `rev-parse` denegados. | Sesión 009 |
| Cuelgues | La herramienta `question` expira a la hora: 3 casos de ~3650 s dejaron la sesión interrumpida. | Sesión 009 |
| Paralelismo | 22 de 37 olas tuvieron un solo implementer; aceleración real ≈ 1,45×. El orquestador razonaba las olas «a mano» por fases. | Sesión 009 |
| Cortes | 8 hijos se cortaron por límite de pasos (6 implementers a 40 pasos y 2 researchers). El límite ya se subió a 60/40. | Sesión 009 |
| Retrabajo | Tras `converge` hubo 9 hijos (43 min, 0,38 USD), algunos parecidos a los implementers cortados. `lint` y `tsc` solo corrían al final: dos arreglos tras el `code-review`. | Sesión 009 |
| Decisiones | Las 3 `preguntas_abiertas` del writer en la 009 no se preguntaron: se adoptaron como supuestos sin guardarlas como `decision/<slug>`. Las «Decisiones» de los implementers no se recogían. | Sesión 009 |
| Lectura duplicada | Cada implementer leía `speckit.implement.md`, `tasks.md` completo y `app.instructions.md`. | Sesión 009 |

## 2. Resumen de las etapas

| Etapa | Idea | Se aplica a |
|---|---|---|
| **A** | Recortar lo que entra al contexto y eliminar pérdidas mecánicas (permisos, scripts, estado, cuelgues). No cambia el flujo. | Contrato, permisos, scripts, estado, compactación, `sddorch.md` |
| **B** | Cambiar **quién** hace el trabajo caro: sacar del orquestador el descubrimiento, la planificación de olas y la lectura de documentos. Cambia el flujo. | `specify`/`clarify`, writer, `schedule`, implementer, precedencia |

Qué contiene cada una:

| # | Cambio | Etapa |
|---|---|---|
| 1 | Tope de longitud a los retornos de los hijos | A |
| 2 | Permisos de shell de `release` y `reviewer` + «un comando por llamada» | A |
| 3 | `release` en modo `cierre` y `pr-detail` por archivo | A |
| 4 | `state` compacto y no releer `sddorch.md` | A |
| 5 | Scripts `mark-tasks.sh`, `verify.sh`, `scope-check.sh` | A |
| 6 | `pending_question` en el `state` | A |
| 7 | `compaction.buffer: 800000` | A |
| 8 | Recorte de `sddorch.md` | A |
| 9 | `sddorch-release` con `#low` | A |
| 10 | `specify` y `clarify` en un subagente `general` | B |
| 11 | PRD y RFC como archivos, no como texto en Engram ni en el contexto | B |
| 12 | `schedule` calculado por script (`schedule.mjs`) | B |
| 13 | El implementer lee su `Uxx.md`; límite de 3 tareas / 4 archivos | B |
| 14 | Regla de precedencia entre roles + `cambios_de_contrato` | B |
| 15 | Preflight único de `implement` y `tsc` por ola | B |

## 3. Reducción estimada del contexto del orquestador

Simulación sobre los datos reales de la feature 009 (el orquestador de hoy frente al rediseñado). **No** incluye el efecto de `#low` en el orquestador.

### 3.1 Por paso

| Fase | Paso | Hoy | Solo A | Solo B | A + B |
|---|---|---|---|---|---|
| `plan` | 62 | 127,4K | — | — | 67,6K (−47%) |
| Primera ola de `implement` | 73 | 165,6K | — | — | 80,3K (−52%) |
| Abrir PR | 146 | 285,5K | 239,5K (−16%) | 218,5K (−23%) | **172,4K (−40%)** |
| Fin de sesión | 250 | 470,4K | 396,4K (−16%) | 403,4K (−14%) | **329,4K (−30%)** |

(`—`: la simulación solo aporta esos dos pasos para A y B por separado.)

### 3.2 Contexto leído acumulado

El contexto **leído** acumulado (lo que se reenvía paso a paso) baja un **42%** en la primera feature y un **36%** en la sesión completa. Es la medida que más pesa en latencia y coste.

### 3.3 En los subagentes hijos (009)

| Cambio | Ahorro por implementer | Sobre el contexto máximo (~60K) |
|---|---|---|
| No leer `tasks.md` ni `speckit.implement.md` | ~4K tokens | ~7% |
| Además, no leer `app.instructions.md` | ~6K tokens | ~10% |

`app.instructions.md` ya está cubierto por la sección 11 de `AGENTS.md`, que se carga sola.

### 3.4 Tamaño de `sddorch.md`

| Versión | Caracteres |
|---|---|
| Original | 20,9K |
| Tras añadir lo nuevo | 19,0K |
| Tras la pasada de recorte | **16,6K (−20%)** |

El objetivo inicial era −30%; no se alcanzó porque el archivo debe seguir describiendo los scripts, `specify`/`clarify` en subagente, la precedencia y `pending_question`. Ver [Pendiente](#8-riesgos-conocidos-y-pendiente).

## 4. Decisión de cada etapa

Cada cambio sigue el mismo esquema: **problema → decisión → alternativas descartadas → efecto**.

### Etapa A

#### A1. Tope a los retornos de los hijos

- **Problema:** los retornos se acumulaban (31,5K por feature, 58K por sesión) y cada token se reenvía en cada paso.
- **Decisión:** `sddorch-contract.md` fija un tope de **1.200 caracteres** para `DONE`/`APPROVED` y **2.500** para `BLOCKED`/`FAILED`/`REJECTED`, sin preámbulo y con secciones de pocas líneas. El contrato en sí se acortó, porque lo lee cada hijo.
- **Descartado:** escribir informes completos en archivos desde cada hijo. Se decidió no hacerlo: solo importan las «Decisiones» que afectan a otras tareas y las recoge el orquestador; el resto no necesita persistirse.
- **Efecto:** es la principal palanca de A sobre el crecimiento del contexto.

#### A2. Permisos de `release` y `reviewer`

- **Problema:** 24% de los pasos de `release` se perdían por comandos compuestos rechazados y por git de solo lectura denegado.
- **Decisión:** se añaden `git rev-parse`, `merge-base`, `ls-files`, `remote get-url` y `fetch` a `release`; `rev-parse`, `merge-base`, `ls-files` y `branch` a `reviewer`. Ambos reciben la regla **«un comando simple por llamada»**, y se les indica usar `read`/`glob`/`grep` en lugar de `cat`/`ls`/`sed`.
- **Descartado:** abrir permisos con comodines amplios (`git *`). Rompería el mínimo privilegio: `release` es el único que commitea y no hace `push` salvo confirmación.
- **Efecto:** menos pasos perdidos y menos reintentos; no cambia el flujo.

#### A3. `release` en modo `cierre`

- **Problema:** `commits` y `pr-detail` iban en dos ejecuciones, y el cuerpo completo del PR entraba en el contexto del orquestador.
- **Decisión:** nuevo modo `cierre` (commits + `pr-detail` en una pasada). `release` devuelve solo **título, resumen de hasta 8 líneas y la ruta de `pr-detail.md`**; el usuario puede abrirlo.
- **Se mantiene:** la pregunta obligatoria antes de abrir el PR, incluso en modo Auto.

#### A4. `state` compacto, sin releer `sddorch.md`

- **Problema:** `state` guardaba listas de tareas hechas y se releía el archivo del orquestador tras compactar.
- **Decisión:** `state` ≤ 600 caracteres, una línea por campo, sin tareas hechas (ya están marcadas en `tasks.md`; las unidades viven en `schedule.json`). Tras compactar se recuperan `north`, `state` y `decision/*` con `mem_search` de límite bajo, **no** `mem_context` completo ni `sddorch.md`.
- **Descartado:** guardar todo en un único registro grande: no escala y se reenvía entero.

#### A5. Scripts mecánicos

- **Problema:** marcar tareas, verificar y comprobar el alcance gastaban pasos de razonamiento y salida de terminal en el contexto.
- **Decisión:** tres scripts en `.opencode/scripts/bash/`. Ver [§6](#6-scripts).
- **Efecto:** `verify.sh` devuelve solo PASS/FAIL y las primeras líneas de error (el log completo queda en `.opencode/runs/_verify/`); `scope-check.sh` informa solo de archivos fuera de los `writes`.

#### A6. `pending_question`

- **Problema:** `question` expira a la hora; 3 casos de ~3650 s dejaron la sesión interrumpida y sin saber qué se había preguntado.
- **Decisión:** antes de cada `question` el orquestador guarda `pending_question` en el `state`. Al reanudar, si existe, repite la pregunta antes de nada.
- **Descartado:** subir el tiempo de expiración: no depende del proyecto.

#### A7. `compaction.buffer: 800000`

- **Problema:** con límite de 1M la compactación automática casi nunca se disparaba y el contexto crecía sin contención.
- **Decisión:** `compaction.buffer: 800000` en `opencode.json`. El campo `instructions` ya no se usa (en la versión V2 no se resolvía).
- **Riesgo:** no está verificado que aplique a la versión instalada de OpenCode. Se comprobará en la próxima ejecución.

#### A8. Recorte de `sddorch.md`

Se eliminaron duplicados entre *Interacción*, *Modo Auto*, *Flujo* y *Cómo ejecutas una fase*, y se fusionaron *Señales de harness* y *Presupuesto de pasos*. Ver [§3.4](#34-tamaño-de-sddorchmd).

#### A9. `sddorch-release` con `#low`

- **Decisión:** `model: opencode-go/deepseek-v4.1-flash#low`. `release` es mecánico y de bajo riesgo.
- **No se aplica** a implementers, reviewers ni al orquestador: el efecto de `#low` sobre la calidad **no está medido**. En V2 la variante de un agente primario puede no aplicarse desde el frontmatter (la sesión guarda su modelo aparte); en subagentes sí funciona.

### Etapa B

#### B1. `specify` y `clarify` en un subagente

- **Problema:** corrían en el contexto del orquestador y, con constitución, PRD y RFC, sumaban +68K.
- **Decisión:** corren en un `general`. Como los hijos no preguntan, devuelven `preguntas_abiertas`; el orquestador pregunta con `question` y **reanuda** al mismo hijo con su `sessionID`.
  - `specify`: hasta 3 preguntas por vuelta.
  - `clarify`: el comando exige **una pregunta por vez**, así que cada vuelta devuelve una.
- **Viabilidad:** `.specify/extensions.yml` no tiene hooks, por lo que `specify` no crea rama ni necesita `git`.
- **No se modificó Spec-Kit:** solo cambia quién ejecuta el comando.
- **Riesgo:** mayor número de idas y vueltas con el usuario en `clarify`. A cambio, el orquestador no carga el contenido de los comandos.

#### B2. PRD y RFC como archivos

- **Problema:** el writer guardaba el PRD y el RFC completos en Engram y el orquestador los leía y copiaba.
- **Decisión:** el writer escribe `.opencode/runs/<run>/prd.md` y `rfc.md` (permiso de edición solo en `.opencode/runs/*`). En Engram quedan **punteros** (ruta + resumen de 3 líneas). `specify` recibe la **ruta** del PRD; tras `specify`, el orquestador **mueve** (`mv`) los archivos a `<feature_directory>/discovery/`. Lee el PRD solo si el writer reporta un conflicto sin resolver.
- **Por qué `.opencode/runs/` y no `.specify/`:** no se escribe dentro de `.specify/` (territorio de Spec-Kit). `runs/` queda ignorada por git.
- **Efecto:** la reanudación funciona aunque se borre la memoria, porque la fuente de verdad es el archivo.

#### B3. `schedule` por script

- **Problema:** el orquestador razonaba las olas por fases; 22 de 37 olas con un solo implementer, ≈1,45× de aceleración.
- **Decisión:** `schedule.mjs` calcula las olas de forma determinista. Ver [§6.1](#61-schedulemjs) y [Planificación de tandas](05-scheduling.md).
- **Resultado de la prueba** (tareas T001–T070 de la 009 puestas como pendientes):

| | Ejecución real (009) | `schedule.mjs` |
|---|---|---|
| Tareas | 70 | 70 |
| Olas | 22 | 22 |
| Subagentes / unidades | 47 | 58 |
| Máximo simultáneo | 6 | 10 |

- **Ajustes durante la prueba:** una primera versión daba 30 olas porque mezclaba las tareas de `converge` (T071+) y limitaba a una unidad con archivos compartidos por ola. Se relajaron dos reglas: una tarea `[P]` ya no espera a la última tarea sin `[P]` de su fase, y se quitó el cupo de una unidad `SHARED_FILES` por ola (los conflictos de ruta ya serializan lo que realmente choca).
- **Conservador por diseño:** ante la duda, serializa. Una tarea sin `[P]` espera a todas las anteriores de su fase.

#### B4. El implementer trabaja con su `Uxx.md`

- **Problema:** cada implementer leía `speckit.implement.md`, `tasks.md` completo y `app.instructions.md`, y hubo 8 cortes por límite de pasos.
- **Decisión:** el prompt lleva la ruta de su `Uxx.md` (con `feature_directory`, `## writes` y el texto de sus tareas). No lee `tasks.md` completo ni `speckit.implement.md`. Límite de **3 tareas o 4 archivos** por unidad; si es mayor, cierra con `BLOCKED` en vez de agotar los pasos.
- **Qué pasa con las reglas de `speckit.implement.md`:** lo que aplica a una unidad (tests antes que el código, coordinación por archivos, reportar errores) está resumido en el agente. El resto (hooks, prerrequisitos, gate de checklists, archivos `ignore`) lo resuelve **una sola vez** un [preflight](#b6-preflight-único-y-tsc-por-ola) antes de las olas.

#### B5. Precedencia entre roles y `cambios_de_contrato`

- **Problema:** el writer concilia conflictos con el criterio «evidencia y constitución», sin orden entre roles. Los implementers podían cambiar contratos sin que nadie lo supiera.
- **Decisión de precedencia**, de mayor a menor:
  1. la constitución,
  2. las decisiones del usuario,
  3. lo que ya dicen spec y plan,
  4. la recomendación de rol.

  Seguridad y accesibilidad **bloquean** frente a UX o rendimiento salvo decisión explícita del usuario. Si el conflicto cambia el alcance, va a `question`.
- **`cambios_de_contrato`:** nueva sección del contrato de retorno con lo que el implementer añadió o cambió y que **no** está en `data-model.md` ni en `contracts/`. El orquestador los acumula en `.opencode/runs/<feature>/cambios_de_contrato.md` y se los pasa a `converge` y al `code-review`.
- **Las `preguntas_abiertas` del writer** se tratan igual que las de los researchers, y lo adoptado como supuesto se guarda como `decision/<slug>`.

#### B6. Preflight único y `tsc` por ola

- **Preflight:** un `general` ejecuta los pasos previos de `speckit.implement.md` (hooks, prerrequisitos, gate de checklists, archivos `ignore`) **una vez por fase**, no una por unidad. Una decisión pendiente llega como `preguntas_abiertas`.
- **`verify.sh tsc` tras cada ola:** `lint` y `tsc` solo corrían al final, lo que provocó dos arreglos tras el `code-review`. La ola siguiente no empieza hasta que `tsc` pase.

## 5. Qué NO se hizo y por qué

| Descartado | Motivo |
|---|---|
| Pasar los implementers y reviewers a `#low` | El efecto sobre la calidad no está medido. |
| Pasar el orquestador a `#low` | Mismo motivo; además, la variante de un agente primario puede no aplicarse desde el frontmatter en V2. |
| Reducir imágenes pegadas | Cuestan 1–2K tokens cada una: no es una palanca real. |
| Modificar Spec-Kit | Restricción del proyecto: `.opencode/commands/speckit.*`, `.specify/**` y la constitución **no se tocan**. |
| Guardar informes completos de los hijos en archivos | Solo importan las decisiones que afectan a otras tareas. |
| Abrir permisos con `git *` | Rompe el mínimo privilegio. |
| Reescribir `docs/` ya modificados por el usuario | Se respetaron sus cambios sin commitear. |

## 6. Scripts

Todos en `.opencode/scripts/bash/`.

### 6.1 `schedule.mjs`

```bash
node .opencode/scripts/bash/schedule.mjs <feature_directory>/tasks.md [--run-dir <dir>] [--max N] [--group-tasks N] [--group-files N]
```

Determinista y sin LLM. Calcula el nivel de cada tarea con estas dependencias:

1. Fases bloqueantes (Setup/Foundational) antes de las historias; Polish/Convergence al final.
2. Dentro de una fase, una tarea sin `[P]` espera a todas las anteriores; una `[P]` no espera a ninguna (solo a conflictos de archivo y dependencias explícitas).
3. Dependencias explícitas («depende de T010», «tras T009»).
4. Dependencias entre historias (`USn` … «tras `USm`» en *User Story Dependencies*).
5. Conflicto de archivos: la tarea posterior espera a la anterior si comparten ruta o directorio.

Después fusiona cadenas cortas de una historia en una sola unidad (máx. 3 tareas y 4 archivos), manda instalaciones y tareas sin rutas a olas propias y parte las olas en el máximo simultáneo (`--max`, por defecto 10).

**Salida:** una tabla corta por stdout, `<run-dir>/schedule.json` y un `<run-dir>/units/Uxx.md` por unidad. Marcas en la tabla:

| Marca | Significado |
|---|---|
| `*` | Toca `SHARED_FILES`: nunca se fusiona; solo los conflictos de ruta la serializan. |
| `!` | Sin rutas inferidas o instalación/migración/generador: va en una ola propia. El orquestador debe declarar sus `writes` antes de lanzarla. |

**Límites conocidos**
- Los `writes` se **infieren** de las rutas entre backticks cuyo primer tramo existe en la raíz del repo. Una ruta citada solo como referencia cuenta como escritura (más conservador, no menos seguro).
- `tasks.md` expresa muchas dependencias en prosa; el script cubre lo mecánico y lista lo dudoso. Una dependencia indirecta (un componente que importa un hook creado en otra tarea sin ruta compartida) no se detecta.
- Si una tarea necesita editar un barrel que su descripción no menciona, el implementer lo reportará como bloqueo.

### 6.2 `mark-tasks.sh`

```bash
.opencode/scripts/bash/mark-tasks.sh <tasks.md> T001 T002 …
```

Marca `[X]` por ID y devuelve «marcadas / ya estaban / no encontradas». Exit 1 si algún ID no existe.

### 6.3 `scope-check.sh`

```bash
.opencode/scripts/bash/scope-check.sh snapshot <baseline.tsv>
.opencode/scripts/bash/scope-check.sh check <baseline.tsv> <Uxx.md …>
.opencode/scripts/bash/scope-check.sh check <baseline.tsv> --paths <ruta|prefijo/|glob> …
```

`snapshot` guarda el estado del árbol antes de la ola; `check` lista solo lo cambiado **fuera** de los `writes`. Exit 1 si hay archivos fuera de alcance.

### 6.4 `verify.sh`

```bash
.opencode/scripts/bash/verify.sh [--log-dir <dir>] [lint tsc test build]
```

Sin argumentos corre `lint`, `tsc`, `test` y `build`, sin detenerse en el primer fallo. Muestra PASS/FAIL, duración y, si falla, las primeras líneas de error.

## 7. Mapa de archivos

### Modificados

| Archivo | Cambio |
|---|---|
| `.opencode/agents/sddorch.md` | Recorte (−20%), `specify`/`clarify` en subagente, scripts, `pending_question`, precedencia |
| `.opencode/agents/sddorch-writer.md` | Escribe PRD/RFC como archivos; punteros en Engram; precedencia |
| `.opencode/agents/sddorch-implementer.md` | Lee su `Uxx.md`; límite 3 tareas / 4 archivos; `cambios_de_contrato` |
| `.opencode/agents/sddorch-release.md` | `#low`, permisos de git, un comando por llamada, modo `cierre` |
| `.opencode/agents/sddorch-reviewer.md` | Permisos de git, un comando por llamada, revisa `cambios_de_contrato` |
| `.opencode/instructions/sddorch-contract.md` | Tope de retorno, `cambios_de_contrato`, contrato más corto |
| `.opencode/instructions/memory.instructions.md` | Punteros `prd`/`rfc`, `state` compacto, `pending_question` |
| `.opencode/.gitignore` | `runs/` |
| `.opencode/README.md` | Scripts y `runs/` |
| `opencode.json` | `compaction.buffer: 800000` |

### Nuevos

`.opencode/scripts/bash/schedule.mjs`, `mark-tasks.sh`, `scope-check.sh` y `verify.sh`; y este documento.

### No tocados

`.opencode/commands/speckit.*`, `.specify/**` (solo se lee `feature.json`) y la constitución.

## 8. Riesgos conocidos y pendiente

| Riesgo / pendiente | Detalle |
|---|---|
| Sin medición real | Todas las cifras de §3 son simulación. Hay que medir una ejecución nueva. |
| `compaction.buffer` | No verificado que se aplique en la versión instalada de OpenCode. |
| `clarify` en subagente | Hay que comprobar que `preguntas_abiertas` llega bien formado y que la reanudación por `sessionID` funciona. |
| Unidades `!` | El orquestador debe declarar los `writes` antes de lanzarlas; si no, la ola propia pierde paralelismo. |
| `sddorch.md` a 16,6K | Por debajo del objetivo de 14K. Opciones: mover detalle a un archivo de lectura condicional (ahorro ~1,5–1,7K, pero añade una lectura). |
| Sesiones concurrentes | En la 009 otra sesión escribió en el mismo árbol a la vez; no se puede garantizar el alcance en ese caso. |
| Iteraciones tras el PR | Siguen sumando 40–70K cada una; solo las contienen la compactación o una sesión nueva. |
| Calidad de los gates | Sin analizar aún cuántos `REJECTED` aportan y cuántos son ruido. |
| Coste fijo por agente | Skills, MCP y Code Mode por hijo: sin analizar. |

## Cómo medir la próxima ejecución

Lanza una feature pequeña con una **sesión nueva** del agente `sddorch`. Evita pegar imágenes grandes en el orquestador y no abras otra sesión que escriba en el mismo árbol.

| Métrica | Referencia 009 | Meta (simulada) | Medido |
|---|---|---|---|
| Contexto tras `plan` (paso ≈62) | 127,4K | 67,6K | |
| Contexto en la 1ª ola de `implement` (paso ≈73) | 165,6K | 80,3K | |
| Contexto al abrir el PR (paso ≈146) | 285,5K | 172,4K | |
| Contexto al final | 470,4K | 329,4K | |
| Olas con un solo implementer | 22 de 37 | menos | |
| Máximo simultáneo | 6 | hasta 10 | |
| Hijos cortados por límite de pasos | 8 | 0 | |
| Pasos de `release` perdidos por permisos | 24% | ~0% | |
| Arreglos tras el `code-review` por `lint`/`tsc` | 2 | 0 | |
| Veces que se usan los scripts | — | siempre | |

Qué comprobar en la sesión:

1. `specify` y `clarify` devuelven `preguntas_abiertas` y se reanudan por `sessionID`.
2. `schedule.mjs` se ejecuta y las unidades `!` reciben `writes` antes de lanzarse.
3. `release` en modo `cierre` commitea y genera `pr-detail.md` en una sola pasada.
4. La compactación se dispara cerca de 800K (si se llega).
5. Los hijos respetan el tope de retorno.
