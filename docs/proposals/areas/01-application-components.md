# Área 01 — `Application/Components` (Molecules, Organisms, Layout)

> Análisis **de solo lectura**. Sin cambios de código de producto.
> Leyenda base: `docs/proposals/inventario-gordos.md`. Umbral GORDO: ≥150 líneas.
> Alcance: `src/Application/Components/Molecules/**`, `Organisms/**`,
> `Layout/**`. NO se tocan dominios, `Infrastructure/` ni `ui/`.

## Resumen del área

Entran **29 archivos** (24 Molecules, 3 Organisms, 3 Layout; las specs y barrels
no cuentan) con **~1.669 líneas** en total. Solo **`HistoryEntry.tsx` (330) es
GORDO**; `AlertMessage.tsx` (148) y `ToolCallEntry.tsx` (128) quedan justo bajo
el umbral pero son **hubs de reutilización claros** (bases de las familias de
estado vacío y de las filas de herramienta). Los problemas dominantes son: (1)
un `switch` de 14 casos JSX dentro de `HistoryEntry` con 8 mapas de
label/estilo embebidos; (2) **duplicación transversal** de mapas de estado
(`IDLE_LABEL`/`OUTCOME_LABEL`/`NODE_STATUS_LABEL`; `QUESTION_STATE_*` vs
`STATE_*`; `STATUS_COLOR` de tool vs `ToolHistory`) y del bloque de pregunta; y
(3) **violaciones de la regla "prohibido `div` con `flex`"** en `HistoryEntry` y
`ToolCallEntry`.

---

## Propuestas por archivo

### `src/Application/Components/Organisms/HistoryEntry.tsx` — 330 líneas (motivo: **d** JSX-GORDO)

Contiene 8 mapas `Record<...>` de label/franja, el helper puro `formatModel`, 2
subcomponentes (`InProgress`, `Description`) y `renderBody`, un `switch` de 14
casos que devuelve JSX (líneas 128-302), más el wrapper `HistoryEntry`
(artículo + franja + cabecera).

Se propone un **subdirectorio cohesionado** `Organisms/HistoryEntry/` con
`index.ts` que reexporte `HistoryEntry` (el barrel de Organisms sigue
`export * from './HistoryEntry'`, así que **ningún consumidor cambia de
import**). Decisión de estructura: 11 subcomponentes no caben razonablemente en
archivos planos sueltos; es una extensión menor de la convención (hay precedente
de carpeta con `ui/`). Alternativa plana: sufijos `HistoryEntry.*.tsx` al mismo
nivel.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `HISTORY_KIND_LABEL` | constante/compartido | `Organisms/HistoryEntry/HistoryEntry.constants.ts` | `Record<THistoryEntry['kind'], string>` (14 claves) | Timeline/Modal de History, futuros listados de entradas | 16 |
| `HISTORY_KIND_STRIPE` | constante/compartido | `…/HistoryEntry.constants.ts` | `Record<THistoryEntry['kind'], string>` (clases `border-*`) | misma familia; unifica la franja lateral | 16 |
| `HistoryEntryBody` | subcomponente | `Organisms/HistoryEntry/HistoryEntryBody.tsx` | `{ entry: THistoryEntry; sessionId: string \| null; renderCompactionContext?: (id: string) => ReactNode }` — dispatcher por `kind` | `HistoryEntry` (único); opcional: Inspector | 40 |
| `UserEntryBody` | subcomponente | `…/bodies/UserEntryBody.tsx` | `{ entry: THistoryUserEntry }` (texto + `<AttachmentList/>`) | History (FR-007) | 22 |
| `TextEntryBody` | subcomponente | `…/bodies/TextEntryBody.tsx` | `{ text: string; isComplete: boolean; variant: 'answer' \| 'reasoning' }` — `<RichText/>` o `<InProgressText/>` | answer + reasoning (FR-006) | 12 |
| `SwitchEntryBody` | subcomponente | `…/bodies/SwitchEntryBody.tsx` | 3 exports `AgentSwitchedBody` / `ModelSwitchedBody` / `LocationSwitchedBody` con su entry tipada | agent/model/location-switched | 35 |
| `NoticeEntryBody` | subcomponente | `…/bodies/NoticeEntryBody.tsx` | `{ text: string; description: string \| null; tone: 'system' \| 'synthetic' }` | system + synthetic | 15 |
| `SkillEntryBody` | subcomponente | `…/bodies/SkillEntryBody.tsx` | `{ entry: THistorySkillEntry }` | History | 15 |
| `ShellEntryBody` | subcomponente | `…/bodies/ShellEntryBody.tsx` | `{ entry: THistoryShellEntry }` + `SHELL_STATUS_LABEL` | History (FR shell) | 22 |
| `CompactionEntryBody` | subcomponente | `…/bodies/CompactionEntryBody.tsx` | `{ entry: THistoryCompactionEntry; sessionId; renderCompactionContext? }` | History (FR-035) | 26 |
| `QuestionEntryBody` | subcomponente | `…/bodies/QuestionEntryBody.tsx` | `{ entry: THistoryQuestionEntry }` — delega en `<QuestionBlock/>` (compartida) | History (FR-033) | 14 |
| `IdleEntryBody` | subcomponente | `…/bodies/IdleEntryBody.tsx` | `{ entry: THistoryIdleEntry }` + `OUTCOME_LABEL` | History (idle) | 8 |
| `InProgressText` | subcomponente (compartido) | `Molecules/InProgressText.tsx` | `{ className?: string }` → span "En curso" | ToolCallEntry, AgentNode, cualquier estado streaming | 8 |
| `AttachmentList` | subcomponente (compartido) | `Molecules/AttachmentList.tsx` | `{ attachments: THistoryAttachment[] }` | History y cualquier vista de prompt | 18 |
| `QuestionBlock` | subcomponente (compartido) | `Molecules/QuestionBlock.tsx` | `{ title; fields: {key,title,options}[]; state; answer }` (forma normalizada) | **HistoryEntry + Inspector `QuestionsSection`** | 30 |
| `formatModelRef` | funcion-pura | `Application/Helpers/formatModelRef.ts` | `(model: ModelRef) => string` (`provider/id`) | HistoryEntry, HistoryHeader, Inspector ModelSection, Graph AgentNode/cardHeight | 6 |
| `OUTCOME_LABEL` | constante/compartido | `Application/Helpers/outcomeLabel.ts` | `Record<TIdleOutcome, string>` | HistoryEntry (`IDLE_LABEL`) + HistoryHeader (`OUTCOME_LABEL`) | 6 |

**Resultado estimado**: `HistoryEntry.tsx` pasa de **330 a ~45 líneas**
(wrapper `article` + cabecera `KIND_LABEL`/franja + `<HistoryEntryBody/>`); el
resto vive en 11 archivos atómicos de ~8-40 líneas en el subdirectorio, más 2
helpers y 1 constante compartida.

**Riesgos/specs afectados**: `Organisms/specs/HistoryEntry.spec.tsx` (FR-033:
respondida/cancelada/opciones; FR-035: contexto de compactación) debe seguir
verde porque **las props públicas de `HistoryEntry` no cambian**. También
consumen este componente `History/Components/HistoryTimeline.tsx` y
`Inspector/Components/AnswersSection.tsx` (vía barrel) y sus specs
(`HistoryTimeline.spec.tsx`, `HistoryModal.spec.tsx`, `InspectorPanel.spec.tsx`).
Reglas FR a preservar literalmente: FR-003/006/007/011/033/035. El `ReaddText`
de answer/reasoning no debe perder el saneo (`rehypeSanitize`).

---

### `src/Application/Components/Organisms/ToolCallEntry.tsx` — 128 líneas (candidato claro, motivo: reutilización + `div.flex`)

Bajo el umbral, pero es **duplicación transversal confirmada** (Familia 4 del
inventario): `STATUS_COLOR`/`STATUS_LABEL` solapan con
`Inspector/Components/ToolHistory.tsx`. Además contiene `formatInput` (pura,
reutilizable) y `ToolField`, y usa `<div className="flex ...">` en 3 sitios
(prohibido por AGENTS §8.4).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `formatToolInput` | funcion-pura | `Application/Helpers/formatToolInput.ts` | `(input: unknown) => string` (usa `UNAVAILABLE`) | ToolCallEntry + Inspector ToolHistory | 12 |
| `ToolStatusBadge` | subcomponente (compartido) | `Molecules/ToolStatusBadge.tsx` | `{ status: TToolStatus \| TToolHistoryStatus; className?: string }` — label + color unificados | **ToolCallEntry + Inspector ToolHistory** (Familia 4) | 28 |
| `LabeledField` | subcomponente (compartido) | `Molecules/LabeledField.tsx` | `{ label: string; children: ReactNode }` (label uppercase + gap) | ToolCallEntry ("Entrada/Error/Resultado"), cuerpos de HistoryEntry, secciones del Inspector | 12 |

**Resultado estimado**: `ToolCallEntry.tsx` pasa de **128 a ~75 líneas**;
`ToolField` se elimina (reemplazado por `LabeledField`), y los `<div flex>` se
sustituyen por `<Container>` (alineado con la regla anti-`div.flex`).

**Riesgos/specs afectados**: `Organisms/specs/ToolCallEntry.spec.tsx`
(FR-004/FR-011: expandir/colapsar, entrada cruda, error sin inventar resultado,
"Sin resultado todavía"). Los textos exactos "En curso"/"Ejecutando"/"Completada"/
"Fallida" y `aria-expanded` deben conservarse. La unificación de `ToolStatusBadge`
debe admitir la clave extra `pending` que hoy solo existe en ToolHistory.

---

### `src/Application/Components/Organisms/AlertMessage.tsx` — 148 líneas (candidato claro, motivo: **b** MAPAS + naming)

Bajo el umbral, pero es la **base de las 3 pantallas de estado** (`EmptyState`,
`EmptyScreenError`, `EmptyScreenFilter`). Concentra 2 `cva` + 3 mapas
`Record<string, ...>` sin tipar contra la unión de variantes; el icono redondo
duplica el patrón de `Molecules/Alert.tsx` (`defaultIcons`); y el interface se
llama `EmptyStateProps` mientras el componente es `AlertMessage`.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `ALERT_VARIANT_ICON` / `_TITLE` / `_DESCRIPTION` | constante/compartido | `Molecules/alertVariants.ts` | `Record<TAlertVariant, IconDefinition \| string>`, `type TAlertVariant` | **AlertMessage + Alert** (unifican mapas de icono) | 30 |
| `AlertIconBadge` | subcomponente | `Molecules/AlertIconBadge.tsx` | `{ icon: IconDefinition; variant: TAlertVariant }` (círculo `w-16 h-16`) | AlertMessage (y Alert con otro tamaño) | 14 |
| `AlertMessageProps` | tipo | `Organisms/AlertMessage.tsx` | renombrar `EmptyStateProps` → `AlertMessageProps` (fix de naming) | — | 1 |

**Resultado estimado**: `AlertMessage.tsx` pasa de **148 a ~85 líneas**.

**Riesgos/specs afectados**: no hay spec propia de `AlertMessage`; sí la cubren
indirectamente `SessionList.page` y `WorkspacePage.spec.tsx` (estados
isError/empty). Mantener los textos por defecto ("Algo salió mal", "Sin
resultados", …) y los `variant`. Al tipar los mapas contra `TAlertVariant` hay
que conservar las 6 variantes (`error/warning/info/success/empty/search`).

---

### `Layout/` — sin archivos ≥150

`Container.tsx` (73), `Page.tsx` (58) y `AnimatedLayout.tsx` (34) están por
debajo del umbral y ya son compartidos. No se proponen descomposiciones; solo
discrepancias (ver Notas).

---

## Piezas atómicas listas para compartir

Piezas cuyo destino natural es `Application/Components` (Molecules) o
`Application/Helpers` por **reutilización cross-dominio**:

| Pieza | Destino propuesto | Consumidores actuales/futuros | Justificación |
|---|---|---|---|
| `QuestionBlock` | `Molecules/QuestionBlock.tsx` | `HistoryEntry` + `Inspector/QuestionsSection` | El bloque de pregunta (título + estado coloreado + campos/opciones + respuesta) es **casi idéntico** en `HistoryEntry.tsx:262-294` y `QuestionsSection.tsx:114-154`; los tipos son estructuralmente compatibles (Familia 6). |
| `ToolStatusBadge` | `Molecules/ToolStatusBadge.tsx` | `ToolCallEntry` + `Inspector/ToolHistory` | Familia 4: `STATUS_COLOR`/`STATUS_LABEL` de tool duplicados. |
| `LabeledField` | `Molecules/LabeledField.tsx` | `ToolCallEntry` + cuerpos de `HistoryEntry` + secciones del Inspector | Patrón "etiqueta uppercase + campo" repetido (`ToolField`, cabeceras de sección). |
| `InProgressText` | `Molecules/InProgressText.tsx` | `HistoryEntry`, `ToolCallEntry`, `Graph/AgentNode` | Literal "En curso" repetido; atomicidad de un estado de UI. |
| `AttachmentList` | `Molecules/AttachmentList.tsx` | `HistoryEntry` (`THistoryAttachment[]`) | Extrae el `<ul>` de adjuntos (`HistoryEntry.tsx:140-155`) como pieza de presentación. |
| `formatModelRef` | `Helpers/formatModelRef.ts` | `HistoryEntry`, `HistoryHeader`, `Inspector/ModelSection`, `Graph/AgentNode`, `Graph/cardHeight` | `provider/id` repetido literalmente en 5 sitios. |
| `formatToolInput` | `Helpers/formatToolInput.ts` | `ToolCallEntry`, `Inspector/ToolHistory` | Serialización defensiva de input de tool (JSON pretty + fallback `UNAVAILABLE`). |
| `OUTCOME_LABEL` | `Helpers/outcomeLabel.ts` | `HistoryEntry` (`IDLE_LABEL`) + `History/HistoryHeader` (`OUTCOME_LABEL`) | Familia 2: copias literales; alinea con el subconjunto terminal de `NODE_STATUS_LABEL`. |
| `ALERT_VARIANT_*` | `Molecules/alertVariants.ts` | `AlertMessage` + `Alert` | Mapas de icono/título/descripción por variante duplicados entre ambos. |

Nota: los **colores por `TNodeStatus`** (Familia 1: `StatusDot.STATUS_COLOR`,
`NodeStatusRail.RAIL_COLOR`, `ExecutionLanes.STATUS_DOT`) son idénticos, pero
`StatusDot` es el único de los tres dentro de mi área; la fuente única debería
resolverse del lado de Graph (fuera de alcance) consumiendo `NODE_STATUS_LABEL`
+ un mapa de color compartido. Se deja anotado, no propuesto aquí.

---

## Notas / discrepancias con convenciones

1. **`div` con `flex` (AGENTS §8.4 — "prohibido `div` con `flex`; usar
   `<Container>`")**: `HistoryEntry.tsx` (líneas 233, 245, 264, 265) y
   `ToolCallEntry.tsx` (líneas 51, 74, 98) usan `<div className="flex ...">`.
   La descomposición debe migrar esos contenedores a `<Container row|space>`;
   el `<ul className="flex flex-wrap ...">` de adjuntos se conserva como lista
   (semántica) dentro de `AttachmentList`.
2. **Naming desalineado**: `AlertMessage.tsx` declara su interface como
   `EmptyStateProps` aunque el componente es `AlertMessage`. Debe renombrarse a
   `AlertMessageProps` (y `EmptyState/EmptyScreenError/EmptyScreenFilter` son
   wrappers que la heredan). Dirección de dependencia `Molecules/EmptyState →
   Organisms/AlertMessage` invierte la jerarquía esperada (Molecule → Organism);
   valorar mover `EmptyState` a `Organisms/` o `AlertMessage` a `Molecules/`.
3. **Import del SDK en componente de Application**: `HistoryEntry.tsx:3` importa
   `ModelRef` de `@opencode/client`. Es solo `import type` (no rompe la
   Constitución III en runtime, que prohíbe invocar el SDK desde componentes),
   pero acopla `Application` al alias del SDK. Recomendable reexportar el tipo
   desde `Domains/History/History.entity` (p. ej. `formatModelRef` recibiendo la
   forma `{ providerID; id }`).
4. **Inconsistencia de alias**: `ToolCallEntry` usa `@app/Application/lib/utils`
   y `AlertMessage` usa `@/Application/lib/utils` para el mismo `cn`. Unificar.
5. **Deep imports vs barrel**: `HistoryEntry.tsx:2` importa `RichText` por ruta
   profunda (`…/Molecules/RichText`) en vez del barrel de `Application/Components`.
   Menor, pero divergente de la convención de exposición por barrel.
6. **Magic strings/estilos**: el patrón `text-[11px] font-medium uppercase
   tracking-wide text-muted-foreground` (cabeceras de sección) se repite en
   `HistoryEntry`, `ToolCallEntry`, `CompactionContext`, `AnswersSection` y
   `QuestionsSection`; candidato a un `<SectionLabel>` molecule o token de
   tipografía. No está como archivo propio, se anota como refactor de estilo.
7. **Dead code en `Layout/AnimatedLayout.tsx`**: la función hace
   `return <>{children}</>;` antes de un `return <motion.div>` inalcanzable, y
   `framer-motion`/`variants`/`TVariants` quedan sin uso. No es descomposición,
   pero conviene limpiarlo o restaurar la animación.
8. **`Page.tsx` y breakpoints**: usa `md:max-w-[900px]`, `md:p-6`, `md:gap-6` y
   `lg:pb-6`, pero **no** `md:hidden`/`hidden md:block` (lo prohibido). El
   branching de layout sí va por `useDevice()`, así que cumple AGENTS §9.
9. **`CompactionContext.tsx`** importa `../ui/skeleton` directamente en vez de
   exponer el skeleton por barrel; coherente con no tocar `ui/`, se deja igual.
