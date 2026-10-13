# Phase 0 — Research: Detalle del nodo por secciones (tablist) en el Inspector

**Feature**: `014-inspector-detail-tabs` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md)

Insumo principal: [discovery/rfc.md](./discovery/rfc.md) (decisiones del usuario en `sddorch/20261013-inspector-detail-tabs/decision/*`, no se reabren).
Los tres huecos que la spec dejó abiertos se resolvieron en sus `Clarifications` (2026-10-13) y la cuarta pregunta del PRD tiene default razonable documentado en `Assumptions`.

**Unknowns del Technical Context**: ninguno. **`NEEDS CLARIFICATION` abiertos: 0.**

Evidencia de repositorio verificada para este plan (no se re-diagnostica el problema):

- `src/Domains/Inspector/Components/InspectorPanel.tsx:168-210` — el contenido técnico (Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia) vive dentro de `<AdvancedSection>`, colapsado por defecto; los datos y los estados se obtienen de `useInspectorData` (`:78-91`).
- `src/Domains/Inspector/Components/AdvancedSection.tsx:25-41` — envoltorio de ~15 líneas sobre `Disclosure`; **solo** lo usa `InspectorPanel.tsx:7`.
- `src/Application/Components/ui/tabs.tsx:15,30,45` — `TabsList` con `h-control` (alto fijo, sin envoltura); `TabsTrigger` activo = `bg-background` sobre `bg-muted` (1.31:1 oscuro / 1.10:1 claro) y foco por `ring` (`box-shadow`) con `focus-visible:outline-none`; `TabsContent` con `cursor-pointer`.
- `src/Application/Components/ui/input.tsx:14` — patrón de foco del proyecto: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight]`.
- `src/Domains/Inspector/Hooks/useInspectorData.ts:54,96-97` — `isLoading`/`isError` **ya** se exponen (query de mensajes) y ya se pasan a `ContextSection` (`InspectorPanel.tsx:129-130`); las otras cuatro secciones no los reciben.
- `src/Infrastructure/Components/InspectorPane.tsx:197-261` — tablist externo `Detalle | Chat` (mismo primitivo) anidado sobre el futuro tablist interno; `:216-219` ya usa `aria-label="Vistas del panel de detalle"` y `className="m-2 shrink-0"`.
- `src/Infrastructure/Hooks/useDetailTabs.ts` — molde vigente de hook de pestañas (ids `as const`, items con etiqueta, guard, estado efímero).
- `node_modules/@radix-ui/react-tabs@1.1.21` → `TabsContent` mantiene **siempre** el `div` contenedor (`hidden` cuando inactivo) pero solo monta `children` cuando está activo (`children: present && children`). Consecuencia doble: (a) el `Record` de secciones no renderiza las inactivas; (b) cualquier utilidad de `display` en el `className` del `TabsContent` anula `[hidden]` y expone los 7 paneles.
- `src/index.css:35` (`--height-control: 2.6rem`), `:245-248` (`:focus-visible` global con `outline`); `min-h-control` **sí** se genera con este `@theme` (verificado compilando `src/index.css` con `@tailwindcss/postcss`).

---

## R1 — Dónde vive el estado de la pestaña y cómo se cumple FR-003

- **Decisión**: el estado lo posee el componente `InspectorSectionTabs` (vía `useInspectorSectionTabs`), que `InspectorPanel` monta **solo** cuando hay nodo (`InspectorPanel.tsx:99-101` retorna temprano con `InspectorEmptyPrompt` si `node === null`).
- **Rationale**: FR-003 pide simultáneamente (a) que la sección activa **sobreviva al cambio de nodo** y (b) que vuelva a `Subagentes` **al cerrar y reabrir el detalle**. La reconciliación de React da exactamente esa semántica sin estado extra ni efectos: cambiar de nodo A→B conserva el componente (misma posición, mismo tipo) y su estado; cerrar el detalle (`node = null`) desmonta `InspectorSectionTabs` (entra el prompt vacío) y reabrirlo lo remonta con el valor inicial `subagents`. No hace falta `key`, ni resincronización por efecto, ni persistencia.
- **Alternativas consideradas**:
  - *Estado en `InspectorPanel` (que sobrevive al `node = null`)*: obligaría a un efecto de reseteo al pasar a `null` para cumplir FR-003(b); estado derivado y efectos que la constitución V no pide. Rechazada.
  - *`key={node.data.sessionId}` en el componente de pestañas*: forzaría el reset también al cambiar de nodo, contra FR-003(a). Rechazada.
  - *Persistir en `localStorage`*: prohibido por la decisión `tab-inicial` y por las assumptions de la spec. Rechazada.

## R2 — Forma del hook puro (`useInspectorSectionTabs`)

- **Decisión**: espejo literal de `useDetailTabs` (`src/Infrastructure/Hooks/useDetailTabs.ts`), en `src/Domains/Inspector/Hooks/useInspectorSectionTabs.ts`:
  - `INSPECTOR_SECTION_TABS = ['subagents','files','tools','answers','questions','errors','latency'] as const` (orden exacto de FR-001).
  - `INSPECTOR_SECTION_TAB_ID = 'subagents'` (pestaña inicial, FR-003).
  - `TInspectorSectionTab = (typeof INSPECTOR_SECTION_TABS)[number]`, `TInspectorSectionTabItem = { id; label }`.
  - `INSPECTOR_SECTION_TAB_ITEMS` con las 7 etiquetas en orden: Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia (FR-001/FR-005, sin renombrar nada).
  - `INSPECTOR_SECTION_TABS_ARIA_LABEL = 'Secciones técnicas del nodo'` (distinto del externo, FR-013).
  - `INSPECTOR_SECTION_TABS_LIST_CLASSNAME` (constante de presentación del call site, AGENTS §8.5: sin magic strings).
  - `isInspectorSectionTab(value)`, `useInspectorSectionTabs(initialTab = INSPECTOR_SECTION_TAB_ID) → { tab, setTab, tabs }`, con `tab` como `useState` efímero y `setTab` que **ignora** ids inválidos.
- **Rationale**: constitución V (lógica pura y testeable fuera del componente) y II (vive en el dominio Inspector). La guarda `setTab` impide que un `value` inesperado de Radix deje el `Tabs` sin pestaña activa.
- **Alternativas consideradas**: reutilizar `useDetailTabs` generalizándolo (rompe el contrato de `Infrastructure` y mezcla dos tablists distintos; rechazada); estado dentro del componente de presentación sin hook (viola V; rechazada); `Record` de etiquetas en `InspectorPanel` (dos fuentes de verdad; rechazada).

## R3 — Primitivo compartido: alto automático + envoltura sin alterar el tablist externo

- **Decisión**: en `ui/tabs.tsx`, `TabsList` pasa de `inline-flex h-control` a `inline-flex min-h-control flex-wrap` (y mantiene `items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground`). La lista de secciones añade desde el call site `w-full justify-start gap-1` (`INSPECTOR_SECTION_TABS_LIST_CLASSNAME`).
- **Rationale**:
  - `min-h-control` conserva el alto del tablist externo `Detalle | Chat` **al píxel** (una fila ⇒ el mínimo de 2.6rem manda, como hoy) y permite que la lista de 7 pestañas crezca en filas.
  - `flex-wrap` no cambia la presentación de una lista corta (el ancho es *hug* y no hay restricción ⇒ no envuelve); el externo además pasa `shrink-0`, así que nunca envuelve.
  - `w-full` sí lo agrupa `twMerge` (grupo `width`), a diferencia de `h-control` (clase custom no reconocida: por eso el repo usa `h-auto!` en `Disclosure.tsx:16`). Se corrige **upstream** (decisión `primitivo-tabs`) y el call site no duplica overrides.
  - `justify-start` en el call site: con `justify-center` por defecto y ancho *hug* no habría diferencia visible; en la lista envuelta cada fila se lee como lista.
- **Verificado**: `min-h-control` se genera (`min-height: var(--height-control)`) con el `@theme` de `src/index.css` y `@tailwindcss/postcss` (compilación de prueba local).
- **Alternativas consideradas**:
  - *`h-auto!` en el call site* (recomendación UX §6.6): deja el defecto en el externo y duplica el override; rechazada por `decision/primitivo-tabs` y por VIII.
  - *Quitar el alto de la lista por completo*: la lista externa bajaría ~3 px (visible); rechazada.
  - *Añadir un prop/variante `wrap` al primitivo*: superficie nueva para dos usos; rechazada (simplicidad).

## R4 — Indicador activo con separación ≥3:1 (1.4.11), visible en `forced-colors`

- **Decisión**: el `TabsTrigger` gana `border border-transparent` en la base y `data-[state=active]:border-foreground` como indicador adicional a la píldora (`data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow` se conservan).
- **Rationale**:
  - `--foreground` frente al `--muted` adyacente da margen amplio en ambos temas (≈13:1 oscuro, ≈19:1 claro por luminancia relativa), muy por encima del 3:1 exigido; el borde es el "indicador adicional" que pide la decisión `primitivo-tabs`, no un cambio de tokens (FR-007 prohíbe tocar tokens compartidos de color).
  - `border` (no `box-shadow`) sobrevive a `forced-colors`: el modo de contraste forzado elimina `box-shadow` pero respeta el borde no transparente (el transparente se mantiene transparente), de modo que el estado activo sigue distinguiéndose sin depender del color de fondo.
  - Geometría: el borde existe en los dos estados, así que **no hay salto de layout entre activo e inactivo**; el crecimiento es de ~2 px por chip (el `TabsList` mantiene su alto porque `min-h-control` lo absorbe). Precio explícito y mínimo del arreglo compartido; la revisión visual de `Detalle | Chat` queda como validación obligatoria (riesgo del RFC).
- **Alternativas consideradas**:
  - *`ring-1 ring-inset ring-foreground`* (cero impacto geométrico): pasa en temas normales, pero `forced-colors` lo elimina (`box-shadow: none`) y el estado activo desaparece; rechazada.
  - *`ring-ring`*: el token `--ring` da ≈3.1:1 contra `bg-muted`, justo en el umbral (frágil); rechazada.
  - *Subir el fondo del activo a un gris más claro*: cambia la píldora de `Detalle | Chat` y no distingue en `forced-colors`; rechazada.
- **Hallazgo latente (fuera de alcance, FR-007)**: el texto inactivo en tema claro queda en 4.39:1 (<4.5:1). No se toca `text-muted-foreground` ni ningún token compartido; queda registrado.

## R5 — Foco visible por `outline` (2.4.7), con respaldo en `forced-colors`

- **Decisión**: en `TabsTrigger` y `TabsContent` se **quita** `focus-visible:outline-none` + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` y se aplica el patrón de `ui/input.tsx:14`: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight]`.
- **Rationale**: `ring` es `box-shadow` y desaparece en contraste forzado; el `outline` con `Highlight` es el respaldo sancionado por el proyecto y ya probado en `Input`/`Textarea`/`Select`. `ring-offset-background` deja de tener sentido con el nuevo patrón. El `TabsContent` es `tabIndex=0` por Radix (parada de Tab del tabpanel, APG) y necesita el mismo foco visible.
- **Alternativas consideradas**: mantener `ring` y añadir solo el fallback de `forced-colors` (dos mecanismos de foco solapados; rechazada); confiar en la regla global `:focus-visible` de `index.css:245` (depende de que nadie vuelva a poner `outline-none`; el proyecto declara el foco explícitamente en los primitivos; rechazada).

## R6 — `TabsContent`: montaje real y guardia contra utilidades de `display`

- **Decisión**: el `TabsContent` del call site lleva `className="min-w-0 cursor-default mt-3"` y **ninguna** utilidad de `display` (`block`/`flex`/`grid`), que queda prohibido por contrato.
- **Rationale**: con Radix 1.1.21 el `div` del panel inactivo permanece en el DOM con `hidden` y **sin hijos** (verificado en `node_modules/@radix-ui/react-tabs/dist/index.mjs:163-181`). (a) El coste de render no crece: solo el panel activo monta su sección, aunque el `Record` construya 7 elementos. (b) Cualquier `display` en el `className` anula el `[hidden]` del primitivo y expone los 7 paneles (1.3.1/2.4.3) — de ahí la guardia de contrato y el spec con fixture anidado.
- **Alternativas consideradas**: `forceMount` (montaría las 7 secciones siempre; rechazada por VII); utilidades de display en el panel para el layout (`Container`/`SectionFrame` ya aportan el layout interno; rechazada).

## R7 — Hilado de `isLoading`/`isError` en las cuatro secciones sin estado (FR-008)

- **Decisión**: `SubagentsSection`, `ToolHistory`, `AnswersSection` y `ErrorsSection` reciben `isLoading?: boolean` / `isError?: boolean` (opcionales, por defecto `false`) y los resuelven con la prioridad de `SectionFrame` (**error → carga → vacío → datos**). `InspectorPanel` les pasa `isLoading`/`isError` de `useInspectorData` (query de mensajes).
  - `SubagentsSection`, `ToolHistory`, `ErrorsSection`: el comportamiento actual de `isEmpty` no cambia; solo se anteponen error y carga.
  - `AnswersSection`: no usa `SectionFrame` (su cabecera lleva el toggle "Ver/ocultar razonamiento" y mantiene un `isEmpty` que **no** es excluyente con la lista: "Sin respuestas todavía" puede convivir con entradas solo-herramientas, comportamiento cubierto por su spec). Se resuelve el área de lista de forma explícita reusando los nodos por defecto (`EmptyScreenError`, `ListSkeleton`); la cabecera con el toggle y el botón "Ver histórico completo" **permanecen montados** en los cuatro estados, porque ninguno de los dos depende de la query de mensajes (el botón abre el histórico, que tiene su propia fuente).
- **Rationale**: constitución VI y decisión `hilar-estados`; el defecto reportado es un falso "vacío" mientras la actividad está en vuelo (US6/SC-005). Mantener las dos acciones evita retirar afordancias que siguen funcionando en carga/error.
- **Alternativas consideradas**: envolver `AnswersSection` en `SectionFrame` (duplicaría el encabezado "Respuestas" o forzaría a mover el toggle/`isEmpty` a un modelo que no es el suyo; rechazada); ocultar el toggle y el botón durante la carga (quita acciones útiles; rechazada).

## R8 — Retirada de `AdvancedSection` y limpieza documental acotada (FR-010)

- **Decisión**:
  - Se **eliminan** `src/Domains/Inspector/Components/AdvancedSection.tsx` y `src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx`; se quita su export de `Components/index.ts`.
  - `Disclosure` **no** se elimina (lo usa `ToolHistory.tsx:47-54`); solo se actualizan sus comentarios que citan "Avanzado" (`Disclosure.tsx:12,46`), junto con los de `InspectorPanel.tsx`.
  - Limpieza documental **acotada** (respuesta Q3 de la spec): los dos contratos vigentes superseded (`specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md` §1 ítem 7, §2.1-2.3, §3.1 y §5:157; `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58`) pasan a describir el tablist (o a remitir al contrato nuevo) en la fase de implementación. El resto de documentos de `specs/004` (spec/plan/tasks/quickstart/data-model/research) queda **histórico**, sin reescribir.
- **Rationale**: FR-010 y su alcance confirmado en `Clarifications`; VIII (los contratos dejan de ser ciertos cuando el comportamiento cambia). El faro del plan es el contrato nuevo de esta feature (`contracts/inspector-section-tabs-contract.md`), que documenta la supersesión con referencias exactas; las ediciones literales de los dos ficheros superseded son trabajo de implementación (Phase 2), no de diseño.

## R9 — Estrategia de specs con tablists anidados

- **Decisión**: cada tablist se localiza por su `aria-label` (`getByRole('tablist', { name })`) o por `data-testid` (`inspector-section-tabs`, `inspector-section-panel`), y las consultas globales se acotan con `within`. Los specs de infraestructura que hoy asumen un único tablist/tabpanel (`InspectorPane.spec.tsx:169-190`, `WorkspaceLayout.spec.tsx:145,164`, `WorkspaceMobileTabs.spec.tsx:189,220`) mantienen el **stub** de `InspectorPanel` (no montan el tablist interno) y, donde haya duda, acotan con `within`/`name`.
- **Rationale**: el anidamiento es un requisito (FR-013) y las queries globales pasan a ser ambiguas. Los paneles inactivos existen con `hidden`, así que los conteos usan `{ hidden: true }` cuando corresponde.
- **Alternativas consideradas**: desambiguar por índice de DOM (frágil; rechazada); `data-testid` en el tablist externo (no hace falta: ya tiene `aria-label`; rechazada).

## R10 — Alternativas descartadas en el RFC (no se reabren)

Se mantienen descartadas, con el motivo ya fijado en el RFC §"Alternativas consideradas":

| # | Alternativa | Motivo de descarte |
|---|---|---|
| A | Footer fijo con el tablist fuera del scroll | `decision/scroll-y-activacion` (evita una tercera región de scroll) |
| B | `TabsList` sticky-bottom dentro del scroll | Solapa las últimas líneas y la línea de pegado queda mal con `p-4` |
| C | Una fila con scroll horizontal | `decision/tablist-wrap` (ocultaría pestañas) |
| D | Rejilla justificada (`grow`) | Rompe la paridad visual con `Detalle \| Chat` |
| E | Quitar los encabezados internos de cada panel | `decision/encabezados-en-paneles` (prevalece accesibilidad) |
| F | Arreglar el primitivo solo por `className` en el call site | `decision/primitivo-tabs` + VIII (`h-control` es custom y `twMerge` no lo agrupa) |
| G | Renombrar "Respuestas" → "Conversación" | `decision/etiqueta-respuestas` |
| H | Badges de conteo por pestaña | `decision/sin-badges` |
| I | `activationMode="manual"` | `decision/scroll-y-activacion` + coherencia con el spec vigente del primitivo |

**Nota de conflicto interno del RFC (§"Conflictos", punto 8)**: el texto del informe de accesibilidad enumeraba el scroll principal como "Identidad → Modelo → Métricas → Recursos → Duración mediana → tablist", **omitiendo Contexto**. Prevalece el norte y `decision/secciones-a-tabs`: **Contexto (Paralelismo + Aporte al padre) permanece** en el scroll principal. El plan y el contrato nuevo lo recogen así.

---

## Re-evaluación post-diseño (Gate Phase 1)

Revisión de [data-model.md](./data-model.md), [contracts/inspector-section-tabs-contract.md](./contracts/inspector-section-tabs-contract.md)
y [quickstart.md](./quickstart.md) contra la constitución:

| Principio | Qué introduce el diseño | Veredicto |
|---|---|---|
| II. Dominios | Todas las piezas nuevas viven en `Domains/Inspector/`; el primitivo tocado ya es compartido; ninguna importa otro dominio | PASS |
| III. TanStack Query | 0 consultas, 0 claves, 0 accesos al SDK; se reutilizan los `isLoading`/`isError` que ya expone `useInspectorData` | PASS |
| IV. Tipos del SDK | Solo tipos de vista del dominio; ningún tipo del SDK redefinido | PASS |
| V. Lógica pura y testeable | El estado y la definición del tablist salen a un hook con spec propio; el componente no contiene lógica de estado | PASS |
| VI. Estados de pantalla | Los cuatro paneles sin estado pasan a resolver error → carga → vacío → datos, con invariante explícita en el contrato (§5) | PASS |
| VII. Rendimiento | Solo el panel activo monta hijos; no se altera el camino SSE/enriquecimiento; la deuda de medición (jank del recorrido, reflujo del pill) queda registrada en el plan | PASS |
| VIII. Convenciones | Specs junto al código, constantes en vez de magic strings, corrección upstream sin duplicar overrides, limpieza documental acotada | PASS |

Ningún artefacto de diseño añade estado de servidor, consultas, rutas, tokens de color ni
dependencias. `Complexity Tracking` sigue vacío.

---

**Salida de Phase 0**: `research.md` con R1–R10; 0 `NEEDS CLARIFICATION`; habilitado el diseño de Phase 1 ([data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)).
