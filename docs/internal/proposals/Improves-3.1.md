# Improves-3.1 — Pendientes tras el cierre de señales de harness

**Estado:** propuesto (para ejecutar en otra sesión)
**Fecha:** 2026-10-13
**Origen:** rama `chore/harness-signals` (commits `eaf5456`…`92aa91f`). Este plan recoge lo que quedó fuera a propósito.

Cada bloque es independiente. Orden recomendado: **A → B → C → D**. A y B son baratos y sin riesgo; C es el único cambio de producto grande.

---

## A. Resolver los `mem_judge` pendientes (Engram)

**Qué:** hay observaciones de Engram con conflictos sin resolver (`judgment_required`) de guardados anteriores: #600 y #601 (findings de calidad y accesibilidad del Chat interactivo), #622 y #623 (señales de harness). #623 ya se marcó APLICADO en esta rama, pero su conflicto sigue abierto.

**Por qué quedó fuera:** requieren decisión del usuario (relaciones `supersedes` / `conflicts_with`), según la regla de Engram para observaciones de tipo `decision` o `architecture`.

**Pasos:**
1. Listar los conflictos abiertos: `mem_review` (`action: list`) y/o `mem_doctor`. Si no aparecen ahí, `mem_search` por `judgment` o leer #600, #601, #622 y #623 con `mem_get_observation` y comprobar si `mem_save` devolvió candidatos.
2. Por cada par, usar `mem_compare` y decidir con el usuario: `compatible`, `related`, `scoped`, `supersedes` o `conflicts_with`.
3. Registrar cada veredicto con `mem_judge` (`judgment_id` por candidato, nunca el id global) y, si el usuario dio una instrucción explícita, incluir sus palabras en `evidence`.

**Hecho cuando:** `mem_review list` no devuelve conflictos para esos ids.

---

## B. Señal #622 `empty-contract-response` (sin corrección clara)

**Qué:** varios implementers terminaron el trabajo pero devolvieron una respuesta final vacía o corrupta (T009/T010, T018/T019, T035, T073/T075, T074/T076; corrupta en T042/T044). Repeticiones ≥4. El orquestador tuvo que verificar a mano con `git status` y specs acotadas.

**Por qué quedó fuera:** no hay un único arreglo obvio. Puede ser agotamiento de `steps` (el implementer tiene 60), un prompt que no refuerza el bloque final o un fallo del modelo.

**Pasos:**
1. Revisar `.opencode/instructions/sddorch-contract.md`: la regla de cierre («persiste y cierra con `BLOCKED`») cubre el caso de agotar pasos, pero no el de una respuesta final vacía.
2. Opciones a evaluar (elegir una con el usuario):
   - añadir al final del prompt de `sddorch-implementer` una línea fija: «tu último mensaje es SIEMPRE el bloque del contrato, aunque no hayas terminado»;
   - que `sddorch.md` trate una respuesta vacía como `UNVERIFIED` y lance una verificación automática (`scope-check.sh` + specs acotadas) antes de relanzar;
   - ambas.
3. Aplicar, documentar en `docs/es|en/sdd/04-subagents.md` y marcar #622 como APLICADO con el hash.

**Hecho cuando:** el contrato y el orquestador definen qué hacer ante una respuesta vacía, y la señal queda cerrada en Engram.

---

## C. Refactor residual de `WorkspacePage.tsx` y `useGraphEnrichment.ts`

**Qué:** el inventario `docs/internal/proposals/inventario-gordos.md` marca ambos como archivos grandes:
- `src/Infrastructure/WorkspacePage.tsx` (hoy ~500 líneas; el inventario contaba 413): clasificado **(c) LÓGICA-MEZCLADA**. Una docena de hooks, `useMemo` y `useEffect`, instrumentación de perf, lógica del overlay histórico y tres bloques JSX inline (`rail`, `graphPane`, `inspectorPane`) conviven en un mismo componente.
- `src/Domains/Graph/Hooks/useGraphEnrichment.ts` (hoy ~255 líneas; el inventario contaba 351): carga por lotes, scheduling en idle, escritura en caché compartida y fusión de enriquecimiento.

**Por qué quedó fuera:** es un cambio grande de comportamiento sin un fallo concreto que lo motive, y tiene specs de rendimiento y estabilidad (`WorkspacePage.perf.spec.tsx`, `useGraphEnrichment.freshness.spec.tsx`) que condicionan el riesgo.

**Pasos (si se decide hacerlo):**
1. Abrir una feature propia con Spec-Kit (`specify → plan → tasks`), no un parche suelto. Basar el alcance en `docs/internal/proposals/consolidacion/plan-priorizado.md`, que está **probablemente desactualizado**: revalidar las acciones contra el código actual antes de usarlo.
2. `WorkspacePage.tsx`: extraer los tres bloques JSX a `Infrastructure/Components/` y la lógica de overlay histórico y perf a hooks en `Infrastructure/Hooks/`. Sin cambios de contrato público.
3. `useGraphEnrichment.ts`: separar carga por lotes, scheduling en idle y fusión en funciones puras con tests propios, manteniendo `sameNodeData` y los comparadores de reconciliación (los campos derivados deben re-renderizar).
4. Antes de tocar nada, correr `pnpm test` y guardar el tiempo y el número de tests como línea base; los specs de perf no deben empeorar.

**Hecho cuando:** `WorkspacePage.tsx` queda sin bloques JSX grandes inline, `pnpm tsc`, `pnpm lint` y `pnpm test` pasan, y los specs de perf no regresionan.

---

## D. Señales viejas que conviene decidir (no tocadas)

| # | Señal | Estado | Decisión pendiente |
|---|---|---|---|
| 589 | Permisos de shell en subagentes | `reviewer` y `researcher` ya tienen git de lectura. `release` mantiene `open-pr.sh` en `ask` a propósito (compuerta de seguridad). | ¿Se permite que `release` abra el PR solo? Es un cambio de una línea en `.opencode/agents/sddorch-release.md`. Si no, cerrar como «decisión: se mantiene `ask`». |
| 590 | Campo requerido rompe fixtures | La convención ya está en `AGENTS.md` (campos derivados opcionales). | Marcar APLICADO citando `AGENTS.md`. |
| 591 | Dos grupos tocan el mismo spec | Mitigado en parte por `scope-check.sh --per-unit` (`RECLAMADO POR n UNIDADES`). | Falta que el prompt del implementer prohíba tocar specs fuera de `writes`. Confirmar si ya está; si no, añadirlo. |
| 592 | Patrón de test para device-gating | Cubierto por `renderWithProviders({ seed })`. | Marcar APLICADO (hash `ddb98a0`). |

---

## Verificación común

- `pnpm tsc`, `pnpm tsc:node`, `pnpm lint` y `pnpm test` en verde antes de cada commit.
- Commits Conventional (`chore(opencode): …`, `refactor(...)`, `docs(...)`), asunto ≤50 caracteres.
- Los cambios de harness se reflejan en `docs/es/sdd/` y `docs/en/sdd/`.
- No usar `git push` ni abrir PR sin confirmación explícita.
