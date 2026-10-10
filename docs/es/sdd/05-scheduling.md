# Planificación de tandas (`schedule`)

## El problema

SddOrch **no usa worktrees**: todos los subagentes comparten el mismo árbol de
trabajo. Eso es rápido y simple, pero peligroso: si dos subagentes editan el
mismo archivo a la vez, el resultado es impredecible.

`schedule` es la fase que convierte `tasks.md` en **tandas** de ejecución
paralela segura, donde ningún subagente pisa el trabajo de otro.

## Cómo se calcula una tanda

De cada tarea pendiente (`- [ ]`) en `tasks.md` se extraen:

- sus rutas de escritura,
- su marca `[P]` (paralelizable),
- sus dependencias.

Una **tanda** admite tareas que cumplan **todas** estas condiciones:

1. están marcadas `[P]`,
2. no tienen dependencias pendientes,
3. **no comparten archivos ni directorios de escritura** entre sí.

Ante la duda, las tareas van en secuencia. El paralelismo es una optimización,
no un objetivo: se prefiere la seguridad.

## Archivos compartidos

Ciertos archivos son punto de conflicto por naturaleza: barrels (`index.ts`),
`queryKeys.ts`, rutas, `Routes.tsx`, `package.json`, lockfiles, etc. SddOrch
los declara como `SHARED_FILES`.

Regla: las tareas que tocan un `SHARED_FILES` **salen** de la tanda y van a una
**tanda de integración** al final de su fase, con **un único** subagente.

Si `tasks.md` marca un archivo como compartido entre historias, se trata igual
que un `SHARED_FILE`: nunca dos grupos de la misma tanda lo escriben, **aunque
las tareas estén marcadas `[P]`**.

## Otras reglas de `schedule`

- Instalaciones de dependencias, migraciones y generadores van **solos** en su
  propia tanda.
- Si hay más tareas que `MAX_PARALLEL_IMPLEMENT` (por defecto 10), la tanda se
  divide en varias tandas sucesivas.
- Al pasar los `writes` a cada subagente se indica explícitamente que **no debe
  tocar archivos fuera de su lista** sin autorización.
- El plan de tandas (cuántos subagentes por tanda) se muestra al usuario y se
  guarda en la memoria del flujo.

## Verificación de alcance

Al terminar cada tanda, el orquestador **no confía**: contrasta
`git status --porcelain` contra los `writes` declarados.

- Si aparece un archivo fuera de lo declarado, la tanda se marca como fallida y
  no se continúa sin resolverlo. En modo Auto, se frena.
- Solo el orquestador marca `[X]` en `tasks.md` y guarda el estado.

Esta verificación es lo que hace seguro el paralelismo compartido: el contrato
declara, pero el `git status` comprueba.

## Fallos y reintentos

- Se finaliza la tanda actual antes de decidir.
- Cada tarea fallida se reintenta una vez (`MAX_RETRIES_PER_TASK`) con el error
  como contexto.
- Si persiste, las tareas que dependían de ella se marcan como **bloqueadas**.
- Si falla una tarea **sin** `[P]`, se detiene el flujo.
- En modo Plan se pregunta cómo seguir; en Auto se frena y vuelve a Plan.

## Parámetros relevantes

| Parámetro | Por defecto | Significado |
|---|---|---|
| `MAX_PARALLEL_IMPLEMENT` | 10 | Subagentes de implementación simultáneos |
| `MAX_PARALLEL_RESEARCH` | 5 | Researchers simultáneos en el descubrimiento |
| `MAX_DISCOVERY_ROUNDS` | 1 | Rondas extra de investigación para cubrir huecos |
| `FAST_MAX_UNITS` | 15 | Unidades de la ruta rápida; más que esto escala a SDD completo |
| `MAX_RETRIES_PER_TASK` | 1 | Reintentos por tarea fallida |
| `MAX_CONVERGE_CYCLES` | 2 | Ciclos `implement → converge` |
| `AUTO_MAX_TASKS` | 15 | En modo Auto, más tareas que esto devuelve a Plan |

## La ruta rápida usa las mismas reglas

En la **ruta rápida** no hay `tasks.md`: el planificador trabaja con una tabla
de **unidades** (`U1..Un`). Las reglas son idénticas: en una misma **ola** solo
unidades sin dependencias y **sin archivos en común**; las que comparten archivo
se fusionan o van en secuencia; los `SHARED_FILES` van a una unidad de
integración al final. La verificación de alcance (`git status` contra los
`writes`) también es la misma.

## Ventajas

- **Paralelismo real y seguro** sin la sobrecarga de aislar cada subagente.
- **Determinista:** una misma `tasks.md` produce las mismas tandas.
- **Verificable:** `git status` como fuente de verdad del alcance, no la
  palabra del subagente.
- **Degradación elegante:** ante la duda, secuencia; ante un conflicto, tanda
  de integración con un solo agente.
