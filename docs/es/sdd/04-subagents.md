# Subagentes y contrato de retorno

SddOrch no hace el trabajo solo: **delega**. Cada subagente tiene un rol
acotado, permisos mínimos y la obligación de responder siempre en el mismo
formato.

## Catálogo

| Subagente | Modo | Rol | Permisos clave | Presupuesto |
|---|---|---|---|---|
| `sddorch` | primary | Orquestador: descubre, planifica, delega, verifica, escribe memoria | Todo salvo `subagent` genérico y ediciones a Spec-Kit | — |
| `sddorch-researcher-code` | subagent | Investiga un rol técnico con acceso al repo | Solo lectura + skills de su rol + Engram (su clave) + web acotada | 25 pasos |
| `sddorch-researcher-market` | subagent | Investiga producto/marketing/legal con web y sin código | Documentación del proyecto + skills `pm-*` + Engram (su clave) + web abierta | 25 pasos |
| `sddorch-writer` | subagent | Redacta PRD y RFC desde los informes en Engram | Templates + constitución + Engram (`prd`/`rfc`) | 20 pasos |
| `general` | subagent | Ejecuta comandos `plan`, `tasks`, `analyze`, `converge` | General | — |
| `sddorch-implementer` | subagent | Ejecuta tareas de `implement` o una unidad de la ruta rápida | Edita solo sus `writes`; git denegado | 40 pasos |
| `sddorch-reviewer` | subagent | Compuertas de constitución | Solo lectura + skill `code-reviewer` | 25 pasos |
| `sddorch-tester` | subagent | Tests tras `implement` | Edita solo `specs/` y `__fixtures__/` | 40 pasos |
| `sddorch-release` | subagent | Commits, `pr-detail` y PR | Único con `git add/commit`; push denegado salvo script de PR | 25 pasos |

## Permisos: mínimo privilegio

El diseño de permisos es una capa de seguridad, no un detalle:

- **`sddorch-researcher-code`** no puede escribir archivos. Solo `read`,
  `glob`, `grep`, consultas `git` y **solo las skills de su rol**. `*.env*` está
  denegado. Acceso web limitado a dominios técnicos (web.dev, owasp.org, MDN,
  W3C, React, Chrome).
- **`sddorch-researcher-market`** no ve el código: `read` solo sobre `docs/`,
  `specs/`, `AGENTS.md`, `README.md`, constitución y `.opencode/roles/`. Tiene
  web abierta (search + fetch) y solo skills `pm-*`.
- **`sddorch-writer`** no investiga: lee los templates de descubrimiento y la
  constitución, y escribe Engram. No tiene `read` del repo ni web.
- **`sddorch-reviewer`** tampoco escribe: lee y aplica el checklist.
- **`sddorch-implementer`** tiene git denegado (`add`, `commit`, `push`,
  `stash`, `checkout`, `reset`, `rebase`) y no puede tocar `tasks.md`.
- **`sddorch-tester`** puede editar **solo** en `src/*/specs/*` y
  `src/*/__fixtures__/*`.
- **`sddorch-release`** es el **único** que hace `git add` y `git commit`.
  `git push` está denegado; el push lo hace únicamente el script de PR.

## Contrato de retorno

Todo subagente responde con estas secciones, breves:

```markdown
## Resultado
estado: DONE | BLOCKED | FAILED
resumen: <1-3 líneas>

## Artefactos
- `<ruta>` — creado | modificado | leído

## Decisiones
- <decisión relevante y motivo; "ninguna" si no hay>

## Bloqueos
- <qué impide avanzar y qué se necesita; "ninguno" si no hay>

## Verificación
- `<comando>` → <resultado>

## harness_signals
- type: skill | instruction | agent | script | command-hook
  trigger: <situación que lo provocó>
  workaround: <qué hiciste para salir del paso>
  evidence: <archivo, error o comando concreto>
  reuse: <dónde o con qué frecuencia volvería a pasar>
```

Algunos subagentes usan secciones propias:

- `sddorch-researcher-code` / `-market` → `## Resultado` con la **clave** del
  informe, `## preguntas_abiertas` (pregunta, opciones, recomendada, impacto) y
  `harness_signals`. Máx. 10 líneas.
- `sddorch-writer` → `## Resultado`, `## conflictos` y `preguntas_abiertas`.
  Máx. 12 líneas.
- `sddorch-reviewer` → `## Revisión` con `APPROVED | REJECTED`.

## Reglas de alcance (aplican a todo subagente)

1. Hace **solo** lo que pide el prompt; no amplía el alcance.
2. Escribe **únicamente** en los `writes` indicados. Si necesita otro archivo,
   lo reporta como bloqueo; no lo toca.
3. No ejecuta `git add/commit/stash/checkout/reset/push/rebase` (salvo
   `sddorch-release`).
4. No marca tareas en `tasks.md`; lo hace el orquestador.
5. **En Engram solo escriben los researchers y el writer**, cada uno en **su
   propia clave**. Ningún otro subagente toca Engram.
6. **Nunca pregunta al usuario.** Lo que bloquee se devuelve como
   `preguntas_abiertas` y el orquestador las centraliza en una sola pregunta.
7. No corre verificaciones globales (`tsc`, `lint`, `test` de todo el repo)
   mientras otros subagentes escriben en paralelo. Las globales las hace el
   orquestador.
8. No modifica archivos de Spec-Kit.

## Por qué el contrato importa

- **Síntesis trivial:** el orquestador consume secciones fijas, no texto libre.
- **Contexto ligero:** los informes largos van a Engram; al orquestador le llega
  la clave y un resumen (**punteros, no contenido**).
- **Auditoría:** cada respuesta dice qué se tocó, qué se decidió y qué se
  verificó.
- **Frontera clara:** el riesgo se concentra en pocos puntos controlados (Engram
  solo en research/writer; git solo en release).
- **Detección de fricción:** `harness_signals` viaja en el mismo contrato (ver
  [`06-auto-learning.md`](06-auto-learning.md)).
