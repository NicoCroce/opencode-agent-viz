# RFC — Tablist de 7 secciones al final del detalle del nodo (Inspector)

> Decisión técnica con alternativas. Es entrada de `plan`; una vez que existe `plan.md`, manda este.
> Run: `20261013-inspector-detail-tabs`. Insumos: `sddorch/20261013-inspector-detail-tabs/north`, `findings/ux`, `findings/accessibility` y las 11 decisiones `decision/*`.

## Contexto

Estado actual (evidencia en los informes):

- `InspectorPanel` apila los bloques del detalle dentro de un único contenedor con scroll; el contenido técnico vive detrás de un desplegable "Avanzado" (`src/Domains/Inspector/Components/AdvancedSection.tsx:25-41`), un envoltorio de ~15 líneas sobre `Disclosure` que **solo** usa `InspectorPanel` (`InspectorPanel.tsx:7`).
- El primitivo de pestañas `src/Application/Components/ui/tabs.tsx` tiene tres defectos que hoy sufre el tablist "Detalle | Chat" y que bloquean 7 pestañas: alto fijo (`h-control`, `index.css:35`) sin envoltura (`tabs.tsx:15`), indicador activo con contraste 1.31:1 (oscuro) / 1.10:1 (claro) — por debajo de 3:1 de 1.4.11 — y foco por `box-shadow` que desaparece en `forced-colors` (`tabs.tsx:30,45`).
- En escritorio el tablist de secciones será **anidado** dentro del `TabsContent` "Detalle" del tablist externo (`src/Infrastructure/Components/InspectorPane.tsx:248-253`); en móvil no hay tablist externo (`InspectorPane.tsx:197,262`) y el tablist de destinos móviles es de otro patrón visual (`WorkspaceMobileTabs.tsx:99-129`), así que no hay colisión.
- Cuatro secciones (Subagentes, Herramientas, Respuestas, Errores) no exponen hoy `isLoading`/`isError` aunque su fuente (`useInspectorData.ts:54,96-97`) sí los expone y ya se los pasa a Contexto (`InspectorPanel.tsx:129-130`): afirman vacío mientras la query está en vuelo.

Por qué hace falta cambiar: el usuario no ve el contenido técnico sin expandir un desplegable y no hay vistas separadas; además los contratos vigentes documentan ese desplegable, por lo que quedan falsos en cuanto se retire.

## Propuesta

1. Al final del scroll de `InspectorPanel` (después de "Duración mediana por herramienta"), montar un `Tabs` de Radix con **7 pestañas** en orden fijo: Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia. Solo el `TabsContent` activo monta hijos (comportamiento Radix ya verificado en `tabs.a11y.spec.tsx:53-67` y `InspectorPane.spec.tsx:238-253`).
2. Estado de la pestaña en un hook propio del dominio Inspector (puro y testeable, espejo de `useDetailTabs`): tupla `as const` de ids, lista de items con etiquetas, guard de id y `useInspectorSectionTabs()` que arranca en `subagents`. Presentación extraída a `InspectorSectionTabs` con un `Record<TInspectorSectionTab, ReactNode>` exhaustivo por tipo.
3. El `TabsList` interno envuelve en filas (`h-auto w-full flex-wrap justify-start gap-1`), con `aria-label` propio y distinto del externo. El tablist externo conserva su apariencia (hug) — ver riesgos.
4. Corregir el **primitivo** `ui/tabs.tsx` (upstream-first, decisión del usuario): alto automático + envoltura, indicador activo con separación ≥3:1 además de la píldora, y foco por `outline` (patrón de `ui/input.tsx:14`) con `forced-colors:outline-[Highlight]`.
5. Hilar `isLoading`/`isError` de la query de mensajes a Subagentes, Herramientas, Respuestas y Errores (props nuevas; solo las pestañas se comportan distinto).
6. Eliminar `AdvancedSection.tsx` y su spec; retirar su export del barrel; actualizar el docstring/comentarios que citan "Avanzado".
7. Sustituir el contrato del desplegable por el contrato de pestañas (texto al final de este RFC) en `specs/004` y `specs/010`.

## Alternativas consideradas

| Alternativa | Pros | Contras | Descartada porque |
|---|---|---|---|
| A. Footer fijo del panel (tablist fuera del scroll, resumen en scroll propio) | Pestañas siempre visibles (mejor descubrimiento) | Tercera región de scroll en un panel de 280 px; ~132 px de alto a 280 px; exige reset de scroll al cambiar de pestaña | Decisión del usuario (`decision/scroll-y-activacion`); el norte excluye estado extra de scroll |
| B. `TabsList` sticky-bottom dentro del scroll | Pestañas visibles mientras se recorre el resumen | Solapa las últimas líneas de cada bloque (necesita fondo opaco) y la línea de pegado queda rara con `p-4` | Peor que A y que la elegida |
| C. Una fila con scroll horizontal | Alto constante | Oculta pestañas fuera de vista | Decisión del usuario (`decision/tablist-wrap`) |
| D. Rejilla justificada (triggers `grow`) | Sin borde derecho irregular, look segmented control | Rompe la paridad visual con "Detalle \| Chat" | Paridad exigida por el norte |
| E. Quitar los encabezados internos de cada panel (recomendación UX) | 0 cambios en 7 secciones, ~20 px más de contenido por pestaña a 280 px | Los paneles quedan sin ninguna semántica interna y hay que poder anular título en `SectionFrame` | Prevalecen accesibilidad y la decisión del usuario (`decision/encabezados-en-paneles`) |
| F. Arreglar el primitivo solo por `className` en el call site (recomendación UX §6.6) | No toca código compartido | Deja el defecto en el tablist externo y en cualquier uso futuro; `h-control` es clase custom que `twMerge` no agrupa, así que el override queda duplicado y gana por orden en CSS | Decisión del usuario (`decision/primitivo-tabs`): upstream-first |
| G. Renombrar "Respuestas" → "Conversación" (recomendación UX §9.1) | Elimina la ambigüedad de contenido solapado | Cambia una etiqueta que el usuario fijó | Decisión del usuario (`decision/etiqueta-respuestas`) |
| H. Badges de conteo por pestaña (recomendación UX §9.2) | Mitiga el descubrimiento al final del scroll | Amplía el alcance (contar en el panel, props nuevas) | Decisión del usuario (`decision/sin-badges`) |
| I. `activationMode="manual"` | Evita montar/desmontar paneles al recorrer con flechas | Se aparta del comportamiento del tablist externo y del spec vigente del primitivo | Decisión del usuario (`decision/scroll-y-activacion`) |

## Impacto por área

- **UX:**
  - Se elimina un flujo (expandir/colapsar "Avanzado") y su estado local persistente entre nodos (`InspectorPanel.spec.tsx:286-313`); aparece el flujo "elegir sección", efímero y con Subagentes por defecto.
  - El recorrido del panel pasa a: Identidad → Modelo → Métricas → Contexto (Paralelismo + Aporte al padre) → Recursos → Duración mediana por herramienta → tablist → sección activa.
  - El tablist no es sticky: para pulsarlo hay que tenerlo a la vista y el contenido nuevo aparece justo debajo (sin salto de scroll ni estado extra). Coste asumido: queda a 1-3 pantallas del inicio.
  - Estimación de alto del pill: ~132 px / 4 filas a 280 px y ~60 px / 2 filas a 720 px ("Preguntas y permisos" ≈ 174 px de ancho; los 7 chips suman ≈ 726-750 px, así que 2 filas es el caso normal de escritorio). No cabe en una fila en ningún ancho del panel.
  - Redundancia aceptada: "Respuestas" incluye la conversación completa (tipos `user, answer, reasoning, tool, question`, `AnswersSection.tsx:38-44`), es decir también las llamadas a herramienta y las preguntas que tienen pestaña propia.
  - El call site del contenido interno añade `min-w-0 cursor-default mt-3` (el primitivo trae `cursor-pointer`, incorrecto sobre contenido de panel; `twMerge` lo resuelve sin `!`).
- **Seguridad:** sin hallazgos. No hay datos, permisos ni superficie nueva; el contenido mostrado es el que ya se mostraba.
- **Rendimiento:**
  - Radix monta solo el panel activo, así que el coste de render no crece; las 7 entradas del `Record` son elementos, no render.
  - Con activación automática, recorrer con flechas monta/desmonta paneles (Herramientas, Respuestas) → posible jank y pérdida de scroll interno de la sección. Aceptado por decisión; se vigila con la estimación de que las secciones son baratas.
  - Al redimensionar el panel (280↔720 con `useInspectorPanel`) el pill refluye en vivo y su alto cambia → el contenido inferior salta. Consecuencia aceptable del wrap.
- **Calidad:**
  - Hook puro + componente de presentación + `Record` exhaustivo por tipo: añadir una pestaña obliga a aportar su sección (TS estricto).
  - `h-control` es clase custom (`--height-control: 2.6rem`) que `twMerge` **no** reconoce como grupo height (por eso el repo usa `h-auto!` en `Disclosure.tsx:16`): la corrección debe ir en el primitivo, no como override duplicado en el call site.
  - Specs afectados: borrar `AdvancedSection.spec.tsx` (106 líneas, 8 casos sobre `aria-expanded`/`role="region"`); reescribir el bloque US2 de `InspectorPanel.spec.tsx:206-420` (ya no hay "Avanzado" ni `aria-expanded`; `queryByText('Herramientas'|'Errores')` deja de ser válido porque ahora son labels de pestaña siempre visibles → usar `getByRole('tabpanel')`/`data-testid`); acotar queries globales con `within`/`aria-label` en `InspectorPane.spec.tsx:169-190` y, si algún spec monta el panel real, en `WorkspaceLayout.spec.tsx:145,164` y `WorkspaceMobileTabs.spec.tsx:189,220` (`getAllByRole('tablist')).toHaveLength(1)` rompe con el anidado); conservar `useDetailTabs.spec.tsx:55-83` si se extrae un hook hermano; ampliar `ui/specs/tabs.a11y.spec.tsx` con fixture anidado, 7 tabs → 6 paneles `hidden` sin hijos, Home/End con 7 y guardias de clases (`h-auto flex-wrap`, `outline-*` + `forced-colors:outline-[Highlight]`).
- **Accesibilidad:**
  - Arreglos obligatorios en el primitivo: indicador activo ≥3:1 en el tema servido (1.4.11) y visible en `forced-colors`; foco por `outline` (2.4.7); alto automático + wrap (hoy 7 pestañas desbordan/recortan a 280-720 px).
  - Guardia de contrato: prohibido poner utilidades de display (`block`, `flex`…) en el `className` de un `TabsContent` — anulan `[hidden]` y exponen los 7 paneles (1.3.1/2.4.3).
  - Cada tablist con `aria-label` propio y distinto: externo "Vistas del panel de detalle" (`InspectorPane.tsx:217`), interno **"Secciones técnicas del nodo"**. No pasar `id` fijos ni ARIA manual (Radix usa `useId`).
  - `orientation` horizontal (aunque envuelva): ↑/↓ no navegan entre filas y no se debe pasar a `vertical` (se perderían ←/→). El roving tabindex es por índice DOM, así que la envoltura no lo rompe; Home/End funcionan (`tabs.a11y.spec.tsx:99-113`).
  - El `tabpanel` es tab stop por defecto de Radix: 5 paradas de Tab con el anidamiento. Es aceptable según APG; no añadir `tabIndex`.
  - Hallazgos no bloqueantes: contraste del label inactivo en tema claro 4.39:1 (latente, el runtime siempre añade `dark` en `src/main.tsx:15`); `SectionHeading` es un `<span>` (`Molecules/SectionHeading.tsx:23`) → los paneles quedan sin semántica interna, aunque el tabpanel ya está nombrado por su pestaña (`aria-labelledby`); zona táctil de los triggers ≈28 px (cumple 2.5.8 de 24 px, por debajo de la recomendación de 44 px, paridad con "Detalle | Chat"). Los tres van a `preguntas_abiertas`.

## Conflictos entre áreas y resolución

- **UX §3 (quitar los encabezados dentro de cada panel) vs accesibilidad A11Y-9 (mantener una estructura interna por panel):** se mantienen los encabezados y **no se toca `SectionFrame`**. Criterio: accesibilidad prevalece sobre UX y además lo confirmó el usuario (`decision/encabezados-en-paneles`). Coste asumido: la etiqueta se repite con la de la pestaña y se pierde ~1 fila de contenido a 280 px.
- **UX §6.6 ("`ui/tabs.tsx` no se modifica") vs accesibilidad A11Y-1/2/3 (defectos en el primitivo, bloqueantes para 7 pestañas):** se corrige el primitivo (upstream-first). Criterio: accesibilidad prevalece y decisión explícita del usuario (`decision/primitivo-tabs`). Riesgo residual: el tablist externo "Detalle | Chat" también usa el primitivo (ver Riesgos).
- **Accesibilidad A11Y-7 (`activationMode` automático provoca jank al montar/desmontar paneles) vs UX §8 (automático es correcto y coherente con el externo):** se mantiene automático. Criterio: decisión del usuario (`decision/scroll-y-activacion`) y coherencia con el spec vigente del primitivo. Queda como riesgo vigilado, no como pregunta.
- **UX §5/§10-A (footer fijo, pestañas siempre visibles) vs norte (orden fijo del recorrido) y accesibilidad (coste vertical):** tablist dentro del scroll. Criterio: decisión del usuario (`decision/scroll-y-activacion`).
- **UX §9.1 (renombrar a "Conversación") vs etiqueta fijada en el norte:** se mantiene "Respuestas". Criterio: decisión del usuario (`decision/etiqueta-respuestas`); la ambigüedad se acepta y queda documentada.
- **UX §9.2 (badges de conteo) vs alcance del norte:** sin badges. Criterio: decisión del usuario (`decision/sin-badges`).
- **UX §7 (hueco de `isLoading`/`isError`) vs apariencia de estado vacío:** se hilan los estados. Criterio: constitución VI y decisión del usuario (`decision/hilar-estados`).
- **UX §4 (`h-auto!` en el call site) vs accesibilidad A11Y-3 (arreglo en el primitivo):** se arregla el primitivo y el call site no duplica el override. Criterio: constitución VIII (evitar duplicación — `h-control` es custom y `twMerge` no lo agrupa, el override call-site quedaría duplicado y decidido por orden en el CSS) + `decision/primitivo-tabs`.
- **Texto del contrato nuevo de accesibilidad (§2.1) vs norte/`decision/secciones-a-tabs`:** el texto de accesibilidad enumera el scroll principal como "Identidad → Modelo → Métricas → Recursos → Duración mediana → tablist", **omitiendo Contexto**. Prevalece el norte y la decisión del usuario: Contexto (Paralelismo + Aporte al padre) **permanece** en el scroll principal. El contrato de este RFC lo recoge así; si `plan` copia el texto de accesibilidad tal cual, introduce un error.
- **Conflicto sin decisión del usuario (no resuelto aquí):** contraste del label inactivo en tema claro, semántica del `<span>` de encabezado, alcance de la limpieza documental y zona táctil. Van a `preguntas_abiertas` (ver abajo y en el PRD).

## Archivos y contratos afectados

Nuevos:

- `src/Domains/Inspector/Hooks/useInspectorSectionTabs.ts` — `INSPECTOR_SECTION_TABS` (`as const`: `'subagents' | 'files' | 'tools' | 'answers' | 'questions' | 'errors' | 'latency'`), `INSPECTOR_SECTION_TAB_ID = 'subagents'`, `TInspectorSectionTab`, `TInspectorSectionTabItem`, `INSPECTOR_SECTION_TAB_ITEMS` (7 etiquetas en orden), `isInspectorSectionTab(value)`, `useInspectorSectionTabs(initialTab = INSPECTOR_SECTION_TAB_ID) → { tab, setTab, tabs }` (efímero; `setTab` ignora ids inválidos) y `INSPECTOR_SECTION_TABS_LIST_CLASSNAME` para no repetir la cadena de clases (magic strings centralizados).
- `src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx` — 7 items, orden, primera activa, `setTab` ignora ids inválidos (espejo de `Infrastructure/Hooks/specs/useDetailTabs.spec.tsx`).
- `src/Domains/Inspector/Components/InspectorSectionTabs.tsx` — presentación: `InspectorSectionTabs({ sections: Record<TInspectorSectionTab, ReactNode> })`; consume el hook; rinde `Tabs` + `TabsList` (`aria-label="Secciones técnicas del nodo"`, `data-testid="inspector-section-tabs"`) + 7 `TabsTrigger` + 7 `TabsContent` (`className="min-w-0 cursor-default mt-3"`, `data-testid="inspector-section-panel"`; **sin** utilidades de display).
- `src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx` — APG (roving tabindex, `aria-controls`, flechas/Home/End), un solo tabpanel montado, envoltura en filas, estado vacío de una pestaña.

Modificados:

- `src/Domains/Inspector/Components/InspectorPanel.tsx` — construir el `Record` de secciones y sustituir el bloque `<AdvancedSection>…</AdvancedSection>` (`168-210`) por `<InspectorSectionTabs sections={sections} />`; quitar el import (`:7`); actualizar docstring (`56-62`) y comentarios `122-124`, `162-167`, `198-202`; conservar **literalmente** todas las props actuales de cada sección (`renderCompactionContext`, `onOpenHistory`, `threshold`/`onThresholdChange`, `sessionId`); pasar `isLoading`/`isError` a las 4 secciones.
- `src/Domains/Inspector/Components/index.ts` — quitar `export * from './AdvancedSection';` (`:13`), añadir `export * from './InspectorSectionTabs';`.
- `src/Domains/Inspector/Hooks/index.ts` — exportar el hook nuevo.
- `src/Domains/Inspector/Components/SubagentsSection.tsx`, `ToolHistory.tsx`, `AnswersSection.tsx`, `ErrorsSection.tsx` — props `isLoading`/`isError` y resolución de los 4 estados de `SectionFrame`; specs correspondientes.
- `src/Application/Components/ui/tabs.tsx` — `TabsList` con alto automático y envoltura (respetando el alto de control por defecto donde no haga falta envolver); indicador activo con separación ≥3:1 visible en `forced-colors`; foco con `outline` además del ring.
- `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` — fixture anidado (2 tablists con labels distintos e ids únicos), 7 tabs → 6 paneles `hidden` sin hijos, Home/End con 7, guardias de `h-auto flex-wrap` y de foco (`outline-*` + `forced-colors:outline-[Highlight]`).
- `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx` — reescribir `206-420`; la aserción de orden `135-150` sobrevive parcialmente (Modelo…ToolStats siguen siendo encabezados).
- `src/Infrastructure/Components/specs/InspectorPane.spec.tsx` (y, si montan el panel real, `WorkspaceLayout.spec.tsx:145,164` y `WorkspaceMobileTabs.spec.tsx:189,220`) — acotar queries con `within`/`aria-label`; mantener el stub del panel.
- Comentarios obsoletos: `src/Application/Components/Molecules/Disclosure.tsx:12,46`.

Eliminados:

- `src/Domains/Inspector/Components/AdvancedSection.tsx` y `src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx`. `Disclosure` **no** se elimina (sigue usándose en `ToolHistory.tsx:47-54`).

Contratos superseded por este RFC:

- `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md` — **superseded**: §1 item 7 ("Avanzado"), §2.1-2.3 (`33-60`), §3.1 Disclosure "Avanzado" (`66-81`) y §5:157 ("Archivos solo cambia de posición"). Desaparecen `aria-expanded`/`aria-controls`/`role="region"` del Disclosure sin equivalente: los sustituye el patrón tab/tabpanel.
- `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58` — **superseded**: afirmaba que la latencia vive en el disclosure colapsado; la latencia pasa a ser pestaña.
- El resto de documentos de `specs/004` (spec/plan/tasks/quickstart/data-model/research) quedan históricos, no se reescriben (ver `preguntas_abiertas` 3).

Contrato nuevo (sustituye §2 y §3.1 de specs/004; lo cita también specs/010):

- **§2.1 Estructura:** tablist Radix (`ui/tabs.tsx`) de 7 pestañas en orden Subagentes · Archivos · Herramientas · Respuestas · Preguntas y permisos · Errores · Latencia, como **último** bloque del eje vertical, con el contenido de la pestaña activa inmediatamente debajo. El scroll principal queda: Identidad → Modelo → Métricas → **Contexto (Paralelismo + Aporte al padre)** → Recursos → Duración mediana por herramienta. En escritorio es un tablist **anidado** dentro del tabpanel "Detalle"; en móvil es el único.
- **§2.2 ARIA:** cada tablist con `aria-label` propio y distinto (externo "Vistas del panel de detalle"; interno "Secciones técnicas del nodo"); prohibido pasar `id` fijos o ARIA manual; cada panel `role="tabpanel"` con `aria-labelledby` al tab y `aria-controls` en el tab; inactivos `hidden` y sin hijos montados; **prohibido** poner utilidades de display en el `className` de un `TabsContent`; prohibido `role="region"` dentro. El `aria-controls` de un trigger inactivo apunta a un nodo no montado: es la paridad ya existente del tablist externo, no se inventa nada aquí.
- **§2.3 Teclado:** ←/→ mueven y seleccionan (activación automática); Tab entra al tablist y de ahí al panel activo; Home/End primero/último; `orientation` horizontal aunque envuelva.
- **§2.4 Presentación:** `h-auto w-full flex-wrap justify-start gap-1` (sin `h-control` en la lista que envuelve); triggers `whitespace-nowrap`; objetivo ≥24×24 (recomendado 44); `justify-start` para que cada fila se lea como lista.
- **§2.5 Foco y contraste:** foco por `outline` + `forced-colors:outline-[Highlight]`; estado activo con un indicador adicional ≥3:1 (la píldora sola da 1.31:1 oscuro / 1.10:1 claro); texto inactivo ≥4.5:1 en el tema servido (en claro hoy 4.39:1).
- **§2.6 Estados:** cada panel resuelve error → carga → vacío → datos (Subagentes/Herramientas/Respuestas/Errores incluidos, con `isLoading`/`isError` de la query de mensajes); cada panel conserva el encabezado interno de su sección.
- **§2.7 Estado de la pestaña:** efímero (no persistido), inicial `subagents`; ningún cambio al cambiar de nodo.

## Riesgos

- **Cambio en componente compartido (`ui/tabs.tsx`) → regresión del tablist externo "Detalle | Chat"**, que vive en un `Container` row y espera "hug" (chips que abrazan su etiqueta, `InspectorPane.tsx:209-219`). Mitigación: aplicar la envoltura y el ancho completo al uso que lo necesita (el tablist de secciones), manteniendo el comportamiento por defecto donde no hace falta envolver; verificar con `tabs.a11y.spec.tsx` e `InspectorPane.spec.tsx` y revisión visual de "Detalle | Chat" antes de dar por bueno.
- **Queries de test globales que asumen un solo tablist/tabpanel.** `getByRole('tablist')` / `getAllByRole('tab')` / `getAllByRole('tablist')).toHaveLength(1)` rompen con el anidado (`InspectorPane.spec.tsx:169-190`, `WorkspaceLayout.spec.tsx:145,164`, `WorkspaceMobileTabs.spec.tsx:189,220`). Mitigación: mantener el stub del panel en los specs de infraestructura y desambiguar con `within` + `aria-label` o `data-testid`.
- **Jank con activación automática sobre 7 paneles** (montar/desmontar ToolHistory/Answers al recorrer con flechas, A11Y-7). Mitigación: solo un panel monta a la vez; si aparece jank real, medirlo antes de proponer `manual` (reabriría `decision/scroll-y-activacion`).
- **Descubrimiento pobre**: el tablist queda a 1-3 pantallas del inicio y sin badges no se sabe si una pestaña tiene contenido. Aceptado por el norte y por `decision/sin-badges`; se documenta como coste conocido.
- **Alto del pill a 280 px (~132 px / 4 filas)**: reduce el contenido visible de la pestaña y hace saltar el layout al redimensionar. Mitigación: validar a 280 px real antes de cerrar (`UX §4/§9.4`).
- **Ambigüedad "Respuestas" vs "Herramientas"/"Preguntas y permisos"** (contenido solapado). Aceptada por `decision/etiqueta-respuestas`; se documenta en el PRD y en el contrato para que no se lea como bug.
- **Duplicación visible de etiqueta** (pestaña + encabezado del panel). Aceptada por `decision/encabezados-en-paneles`.
- **Nada de lo accesible está verificado en navegador**: ratios renderizados, `forced-colors` real, orden de tabulación, ↑/↓ y métricas de ancho de etiquetas. Mitigación: la verificación queda como deuda explícita de la fase de tasks/implementación.

## Decisiones

Todas son decisiones del usuario y no se reabren: `sddorch/20261013-inspector-detail-tabs/decision/` → `modo-ruta`, `secciones-a-tabs`, `latencia-tab`, `tablist-wrap`, `tab-inicial`, `scroll-y-activacion`, `encabezados-en-paneles`, `primitivo-tabs`, `sin-badges`, `hilar-estados`, `etiqueta-respuestas`.

## Preguntas abiertas

1. **Contraste del label inactivo en tema claro (4.39:1, A11Y-5).** Opciones: (a) corregirlo ahora — toca `text-muted-foreground`/tokens usados en más sitios; (b) dejarlo latente y registrar hallazgo (el runtime siempre añade `dark`). Recomendada: (b). Impacto: bajo hoy, medio si algún día se sirve tema claro.
2. **Semántica del encabezado de sección (A11Y-9).** `SectionHeading` emite un `<span>`; con `role="region"` retirado, los paneles no tienen encabezado real. Opciones: (a) promoverlo a encabezado de nivel 3 (molecule compartido, afecta a todo el panel en la app); (b) dejarlo (el tabpanel ya está nombrado por su pestaña) y registrar hallazgo. Recomendada: (b), fuera de alcance de este run. Impacto: bajo aquí, medio para la app.
3. **Alcance de la limpieza documental (A11Y-11 / UX Q5).** Opciones: (a) actualizar solo los dos contratos vigentes superseded y los comentarios de código tocados; (b) barrer además spec/plan/tasks/quickstart/data-model/research de specs/004. Recomendada: (a). Impacto: medio (trabajo, no producto).
4. **Zona táctil de las pestañas.** Hoy ≈28 px (cumple 2.5.8 de 24 px; recomendación 44 px). Opciones: (a) mantener `py-1` y la paridad visual con "Detalle | Chat"; (b) subir a `py-1.5` (~32 px) solo en el tablist de secciones. Recomendada: (a). Impacto: bajo.
