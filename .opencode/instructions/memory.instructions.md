---
description: Reglas de memoria de SddOrch en Engram. Todo agente que lea o escriba memoria persistente debe seguirlas.
---

# Memoria en Engram

La memoria persistente de los flujos SDD vive en **Engram**. No existe una carpeta `memory/` en el repo (no la crees). La única carpeta con ese nombre es `.specify/memory/` (constitución de Spec-kit) y no se toca.

## Principio

Pasa **punteros, no contenido**. Los informes largos viven en Engram; el orquestador y los demás agentes se pasan la clave y un resumen corto. Así el contexto del orquestador se mantiene pequeño.

## Identificador de la ejecución

`<run>` = `<AAAAMMDD>-<slug-del-pedido>`. La carpeta de la feature (`feature_directory` de `.specify/feature.json`) no existe hasta `specify`, así que todo lo previo cuelga de `<run>`. Cuando se crea, se guarda en el `state`.

## Quién escribe, y dónde

| Agente | Puede escribir |
|---|---|
| `sddorch` (orquestador) | `north`, `state`, `decision/<slug>`, `run`, `harness-signal/*` |
| `sddorch-researcher-<rol>` (`-ux`, `-security`, `-performance`, `-quality`, `-accessibility`, `-market`) / `-code` | solo su `findings/<rol>` |
| `sddorch-writer` | solo `prd`, `rfc` y `recon-discarded` (más los archivos `.opencode/runs/<run>/prd.md` y `rfc.md`) |
| Resto de subagentes | nada |

Esta restricción no la hacen cumplir los permisos (el permiso de Engram es por herramienta, no por clave): se cumple por instrucción. Cada escritura va a **su propia clave**, nunca a una compartida, para que dos agentes en paralelo no se pisen.

## Claves (`topic_key`)

Usa siempre `project: opencode-agent-viz`.

| Clave | Tipo | Contenido |
|---|---|---|
| `sddorch/<run>/north` | `decision` | norte: problema, objetivo, no-objetivos, restricciones (5-8 líneas) |
| `sddorch/<run>/state` | `decision` | modo, ruta, fase, fases hechas, tanda, tareas hechas / fallidas / bloqueadas, rama, `feature_directory` |
| `sddorch/<run>/units` | `decision` | ruta rápida: unidades de cambio (descripción, `writes`, criterio, dependencias, estado) |
| `sddorch/<run>/findings/<rol>` | `discovery` | informe completo de un researcher |
| `sddorch/<run>/decision/<slug>` | `decision` | una decisión: qué, por qué, alternativas |
| `sddorch/<run>/prd` | `decision` | **puntero**: ruta `.opencode/runs/<run>/prd.md` + resumen de 3 líneas (el texto vive en el archivo) |
| `sddorch/<run>/rfc` | `decision` | **puntero**: ruta `.opencode/runs/<run>/rfc.md` + resumen de 3 líneas |
| `sddorch/<run>/recon-discarded` | `discovery` | lo descartado y el motivo |
| `sddorch/<run>/run` | `discovery` | duración por fase, reintentos, tareas fallidas |
| `sddorch/harness-signal/<slug>` | `discovery` | tipo, disparador, workaround, evidencia, nº de repeticiones |

## Contenido de `state`

Corto (≤ 600 caracteres), estructurado, una línea por campo:

```
mode: plan | auto
route: fast | sdd-1 | sdd-2
phase: <fase actual>
done: <fases terminadas, separadas por coma>
wave: <i>/<n>            (las unidades viven en .opencode/runs/<feature>/schedule.json)
tasks: failed [T0xx] · blocked [T0yy]      (las hechas están marcadas en tasks.md)
branch: <rama>
feature_directory: <ruta o "aún no existe">
pending_question: <pregunta que se hizo al usuario y no se contestó, o "ninguna">
updated: <fecha ISO>
```

Guárdalo al terminar cada fase y cada tanda, y **antes de cada `question`** (con `pending_question`). No guardes diffs, salidas de terminal ni listas de tareas hechas.

## Reanudación y compactación

- Al iniciar, busca `sddorch/*/state` (con `limit` bajo, no `mem_context` completo). Si hay una fase sin terminar, ofrece reanudar. Si el `state` trae `pending_question`, vuelve a preguntarla antes de nada. Contrasta con el repo (`tasks.md`, `git status`): Engram dice dónde ibas; los archivos son la verdad.
- Tras una compactación de la conversación, relee `north`, `state` y las claves `decision/*` antes de seguir.
- Guarda cada decisión **en el momento** en que se toma.

## Qué no guardar

- Contenido de `spec.md`, `plan.md` o `tasks.md` (ya viven en `feature_directory`).
- Código, diffs o salidas de terminal.
- Datos personales o secretos.

## Señales de harness

El orquestador guarda cada `harness_signal` reportada con `sddorch/harness-signal/<slug>` (kebab-case) y sube el contador si ya existe. Al cierre solo se proponen las repetidas 2 o más veces o las que provocaron un fallo o un reintento.
