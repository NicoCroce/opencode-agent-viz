---
description: Reglas de memoria de SddOrch en Engram. Todo agente que lea o escriba memoria persistente debe seguirlas.
---

# Memoria en Engram

La memoria persistente de los flujos SDD vive en **Engram**. No existe una carpeta `memory/` en el repo (no la crees). La única carpeta con ese nombre es `.specify/memory/` (constitución de Spec-kit) y no se toca.

## Quién escribe

- **Solo SddOrch (el orquestador) escribe** en Engram. Los subagentes no llaman a `mem_save`: devuelven su resultado al orquestador (ver `sddorch-contract.md`) y él decide qué guardar.
- Cualquier agente puede leer (`mem_search`, `mem_get_observation`, `mem_context`) si el orquestador se lo indica.

## Convención de `topic_key`

`<feature>` es el nombre de `feature_directory` en `.specify/feature.json` (por ejemplo `007-fix-parallel-lanes-live`). Un `topic_key` estable hace que guardar de nuevo actualice la misma observación en vez de crear otra.

| Qué | `topic_key` | Tipo | Contenido |
|---|---|---|---|
| Estado de la ejecución | `sddorch/<feature>/state` | `decision` | modo, fase actual, fases terminadas, tanda actual, tareas hechas / fallidas / bloqueadas, rama |
| Brief del recon | `sddorch/<feature>/recon` | `discovery` | síntesis priorizada: alcance, archivos, riesgos, complejidad, modo sugerido |
| Registro de la ejecución | `sddorch/<feature>/run` | `discovery` | duración por fase, reintentos, tareas fallidas |
| Señal de harness | `sddorch/harness-signal/<slug>` | `discovery` | tipo, disparador, workaround, evidencia, nº de repeticiones |

Usa `project: opencode-agent-viz` en todas las observaciones.

## Contenido de `state`

Mantenlo corto y estructurado:

```
mode: plan | auto
phase: <fase actual>
done: [<fases terminadas>]
wave: <i>/<n>
tasks: done [T001..] · failed [T0xx] · blocked [T0yy]
branch: <rama>
updated: <fecha ISO>
```

Guárdalo al **terminar cada fase** y al cerrar cada tanda. No guardes informes completos de subagentes ni diffs.

## Reanudación

Al iniciar, el orquestador consulta `mem_search` con `sddorch/<feature>/state` (o `mem_context`). Si hay un estado con fase no terminada, ofrece con `question` reanudar desde esa fase o empezar de cero. Contrasta siempre con el repo real (`tasks.md`, `git status`) antes de reanudar: Engram indica dónde estabas, pero los archivos son la verdad.

## Qué no guardar

- Contenido de `spec.md`, `plan.md` o `tasks.md` (ya viven en `feature_directory`).
- Código, diffs o salidas de terminal.
- Datos personales o secretos.

## Señales de harness

Cuando un subagente reporta una `harness_signal`, el orquestador la guarda con `sddorch/harness-signal/<slug>` (slug corto en kebab-case del problema). Si ya existe, actualiza el contador de repeticiones. Al cierre solo se proponen al usuario las señales repetidas 2 o más veces o las que provocaron un fallo o un reintento.
