# Memoria y reanudación

Un flujo SDD puede durar mucho y atravesar descubrimiento, varias fases y
decenas de subagentes. El contexto del modelo es finito y frágil: si se corta,
no queremos empezar de cero. Por eso SddOrch guarda el **estado** y los
**documentos** en memoria persistente.

## Principio: punteros, no contenido

Los informes largos viven en memoria (**Engram**); el orquestador y los demás
agentes se pasan la **clave** y un **resumen corto**. Así el contexto del
orquestador se mantiene pequeño aunque el descubrimiento sea grande.

No existe una carpeta `memory/` en el repo (no la crees). La única carpeta con
ese nombre es `.specify/memory/` (constitución de Spec-Kit) y no se toca.

## Identificador de la ejecución (`<run>`)

`<run>` = `<AAAAMMDD>-<slug-del-pedido>`. La carpeta de la feature
(`feature_directory` de `.specify/feature.json`) **no existe hasta `specify`**,
así que todo lo previo cuelga de `<run>`. Cuando se crea, se guarda en el
`state`.

## Quién escribe, y dónde

| Agente | Puede escribir |
|---|---|
| `sddorch` (orquestador) | `north`, `state`, `decision/<slug>`, `units`, `run`, `harness-signal/*` |
| `sddorch-researcher-code` / `-market` | solo su `findings/<rol>` |
| `sddorch-writer` | solo `prd`, `rfc` y `recon-discarded` |
| Resto de subagentes | nada |

Esta restricción no la hacen cumplir los permisos (el permiso de Engram es por
herramienta, no por clave): se cumple **por instrucción**. Cada escritura va a
**su propia clave**, nunca a una compartida, para que dos agentes en paralelo no
se pisen.

## Claves (`topic_key`)

Todas las observaciones usan `project: opencode-agent-viz`.

| Clave | Tipo | Contenido |
|---|---|---|
| `sddorch/<run>/north` | `decision` | norte: problema, objetivo, no-objetivos, restricciones (5–8 líneas) |
| `sddorch/<run>/state` | `decision` | modo, ruta, fase, fases hechas, tanda, tareas/ unidades, rama, `feature_directory` |
| `sddorch/<run>/units` | `decision` | ruta rápida: unidades de cambio (descripción, `writes`, criterio, dependencias, estado) |
| `sddorch/<run>/findings/<rol>` | `discovery` | informe completo de un researcher |
| `sddorch/<run>/decision/<slug>` | `decision` | una decisión: qué, por qué, alternativas |
| `sddorch/<run>/prd` | `decision` | PRD (entrada de `specify`) |
| `sddorch/<run>/rfc` | `decision` | RFC (entrada de `plan`) |
| `sddorch/<run>/recon-discarded` | `discovery` | lo descartado en el descubrimiento y el motivo |
| `sddorch/<run>/run` | `discovery` | duración por fase, reintentos, tareas fallidas |
| `sddorch/harness-signal/<slug>` | `discovery` | tipo, disparador, workaround, evidencia, nº de repeticiones |

## Contenido de `state`

Corto y estructurado:

```
mode: plan | auto
route: fast | sdd-1 | sdd-2
phase: <fase actual>
done: [<fases terminadas>]
wave: <i>/<n>
tasks: done [T001..] · failed [T0xx] · blocked [T0yy]
branch: <rama>
feature_directory: <ruta o "aún no existe">
updated: <fecha ISO>
```

Se guarda al **terminar cada fase** y al cerrar cada tanda. No se guardan diffs
ni salidas de terminal.

## Qué NO se guarda

- Contenido de `spec.md`, `plan.md` o `tasks.md` (ya viven en la feature).
- Código, diffs o salidas de terminal.
- Datos personales o secretos.

## Reanudación y compactación

- Al iniciar, el orquestador busca `sddorch/*/state`. Si hay una fase sin
  terminar, **pregunta**: reanudar o empezar de cero.
- Contrasta siempre con el repo real (`tasks.md`, `git status`).

  > **La memoria indica dónde estabas; los archivos son la verdad.**

- Tras una **compactación** de la conversación, relee `north`, `state` y las
  claves `decision/*` antes de seguir. Mientras el estado esté en Engram, la
  compactación no pierde nada importante.
- Guarda cada decisión **en el momento** en que se toma.

## Ventajas

- **Flujos largos, tolerantes a interrupciones.** Un corte no obliga a repetir
  descubrimiento, spec, plan y tasks.
- **Contexto ligero.** El orquestador trabaja con punteros y resúmenes, no con
  todos los informes.
- **Trazabilidad.** Queda registro de decisiones, alternativas, tiempos,
  reintentos y fricciones.
- **Aprendizaje acumulativo.** Las señales de harness viven en la misma memoria,
  así que el sistema mejora entre ejecuciones (ver
  [`06-auto-learning.md`](06-auto-learning.md)).
