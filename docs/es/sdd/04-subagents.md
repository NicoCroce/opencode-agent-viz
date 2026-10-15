# Subagentes y contrato de retorno

SddOrch no hace el trabajo solo: **delega**. Cada subagente tiene un rol
acotado, permisos mínimos y la obligación de responder siempre en el mismo
formato.

## Catálogo

| Subagente | Modo | Rol | Permisos clave | Presupuesto |
|---|---|---|---|---|
| `sddorch` | primary | Orquestador: descubre, planifica, delega, verifica, escribe memoria | Todo salvo `subagent` genérico y ediciones a Spec-Kit | — |
| `sddorch-researcher-<rol>` (`-ux`, `-security`, `-performance`, `-quality`, `-accessibility`) | subagent | Investiga un rol técnico con acceso al repo | Solo lectura + **solo las skills de su rol** + Engram (su clave) + web acotada + store en solo lectura (`sqlite3 -readonly`) | 60 pasos |
| `sddorch-researcher-market` | subagent | Investiga producto/marketing/legal con web y sin código | Documentación del proyecto + skills `pm-*` + Engram (su clave) + web abierta | 40 pasos |
| `sddorch-writer` | subagent | Redacta PRD y RFC desde los informes en Engram | Templates + constitución + Engram (`prd`/`rfc`) | 30 pasos |
| `general` | subagent | Ejecuta comandos `plan`, `tasks`, `analyze`, `converge` | General | — |
| `explore` | subagent | Exploración read-only y barata del código (localizar archivos y símbolos) | Solo lectura (`read`, `glob`, `grep`) | — |
| `sddorch-implementer` | subagent | Ejecuta tareas de `implement` o una unidad de la ruta rápida | Edita solo sus `writes`; git denegado | 80 pasos |
| `sddorch-reviewer` | subagent | Compuertas de constitución | Solo lectura + skill `code-reviewer` + Engram + `pnpm tsc/lint/test` para verificar | 40 pasos |
| `sddorch-tester` | subagent | Tests tras `implement` | Edita solo `src/*/specs/*` y `src/*/__fixtures__/*` | 60 pasos |
| `sddorch-release` | subagent | Commits, `pr-detail` y PR | Único con `git add/commit`; crea o cambia de rama (`git switch`); Engram; push denegado salvo script de PR | 50 pasos |

> **Presupuesto (`steps`).** Es el techo de pasos que puede dar cada subagente
> antes de ser cortado. Se calibra con evidencia: si un rol lo agota antes de
> terminar, lo reporta como señal de tipo `agent` y se sube el valor o se parte
> el trabajo en unidades más pequeñas (ver
> [`06-auto-learning.md`](06-auto-learning.md#ajustar-el-presupuesto-de-pasos)).

## Permisos: mínimo privilegio

El diseño de permisos es una capa de seguridad, no un detalle:

- **`sddorch-researcher-<rol>`** y **`-code`** no pueden escribir archivos. Solo `read`,
  `glob`, `grep`, consultas `git` y **solo las skills de su rol** (`-code` no tiene ninguna). `*.env*` está
  denegado. Acceso web limitado a dominios técnicos (web.dev, owasp.org, MDN,
  W3C, React, Chrome). Puede leer el store de OpenCode
  (`~/.local/share/opencode`) en **solo lectura** y consultarlo con
  `sqlite3 -readonly` (también `pnpm test`, `npx vitest` y `node`); si la medición
  excede su presupuesto, la hace el orquestador con un `general` y se la pasa como
  archivo. Un researcher cubre un solo artefacto o rol.
- **`sddorch-researcher-market`** no ve el código: `read` solo sobre `docs/`,
  `specs/`, `AGENTS.md`, `README.md`, constitución y `.opencode/roles/`. Tiene
  web abierta (search + fetch) y solo skills `pm-*`.
- **`sddorch-writer`** no investiga: lee los templates de descubrimiento y la
  constitución, y escribe Engram. No tiene `read` del repo ni web.
- **`sddorch-reviewer`** tampoco escribe: lee, aplica el checklist, puede
  consultar Engram (norte y decisiones) y ejecutar `pnpm tsc`/`lint`/`test` para
  verificar una afirmación concreta.
- **`sddorch-implementer`** tiene git denegado (`add`, `commit`, `push`,
  `stash`, `checkout`, `reset`, `rebase`) y no puede tocar `tasks.md`. Solo ve las skills
  `front-ddd-generator`, `vercel-react-best-practices`, `test-driven-development` y `a11y-*`.
- **`sddorch-tester`** puede editar **solo** en `src/*/specs/*` y
  `src/*/__fixtures__/*` (los *specs de test*, no la carpeta `specs/` de Spec-Kit). Solo ve
  `test-generator` y `test-driven-development`.
- **`sddorch-release`** es el **único** que hace `git add` y `git commit`; puede
  crear o cambiar de rama (`git switch`) y consultar Engram. `git push` está
  denegado; el push lo hace únicamente el script de PR.

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

### Depurar un cuelgue en Vitest

Cuando un spec no falla sino que **no retorna** (CPU al 100 %), no hay ruta
soportada para romper con un depurador: `--cpu-prof` se rechaza dentro de
`NODE_OPTIONS` y `--inspect` solo expone el fork de `tinypool`. Receta que
funciona, siempre sobre un spec acotado:

```bash
pnpm vitest run <spec> --pool=forks --poolOptions.forks.singleFork --inspect
```

Con eso, conéctate por CDP al puerto del inspector:

1. `Debugger.pause` para romper el giro y leer la pila real.
2. `Debugger.setBreakpointByUrl` sobre `scheduleUpdateOnFiber` (React) para ver
   quién dispara el render, o sobre `QueryCache.notify` para ver qué notificación
   cierra el ciclo.
3. Instrumentación temporal con `process.stderr.write('MARK-…')` para acotar el
   último punto alcanzado; **retírala antes de cerrar** (un spec con `MARK-*` no
   se acepta).

En un bucle de render la pila suele terminar en una suscripción a la caché de
TanStack Query (`useCachedQueryData`/`useQuery`) que se despierta también con
`observerOptionsUpdated`, no solo con cambios de dato.

> **Nota:** `vitest.config.ts` fija `pool: 'threads'` con 4 workers. La receta
> (`--pool=forks --poolOptions.forks.singleFork`) pasa los flags por CLI, que
> tienen prioridad sobre la configuración; se ejecutó con la configuración nueva
> y un spec acotado y funciona. Un spec `.spec.ts` corre
> en `node`; si el cuelgue depende del DOM, comprueba que declare
> `// @vitest-environment jsdom` ([detalle](12-optimizacion-verificacion.md#8-convención-para-quien-escribe-specs)).

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
9. Si se está quedando sin presupuesto de pasos, **cierra limpio**: persiste lo
   que tenga y devuelve `BLOCKED` con el contrato, en vez de quedarse sin pasos.
   El **último mensaje es siempre el bloque del contrato**, aunque el trabajo no
   haya terminado: una respuesta final vacía o sin bloque deja el resultado como
   `UNVERIFIED` y el orquestador lo verifica a mano (`scope-check.sh check` + las
   specs acotadas de la unidad) antes de decidir si lo relanza una vez.

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
