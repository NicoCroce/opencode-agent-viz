# Contract — Tablist de secciones técnicas del detalle del nodo

**Feature**: `014-inspector-detail-tabs` | **Date**: 2026-10-13 | **Plan**: [plan.md](../plan.md)

Interfaz **interna de UI** del dominio Inspector (no hay API, CLI ni servicio externo). Fija el
comportamiento observable del detalle del nodo y de las pestañas que gobiernan sus secciones
técnicas. Es verificable con Testing Library (roles, `aria-*`, orden del DOM, contenido
montado/desmontado, guardias de clase).

Este contrato **sustituye** a los siguientes (ver §3):

- `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md` §1 ítem 7, §2.1-2.3, §3.1 y §5:157.
- `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58`.

## §1 Estructura y orden

- El detalle del nodo termina con un **tablist Radix** (`ui/tabs.tsx`) de **siete** pestañas en
  este orden exacto:

  ```text
  Subagentes · Archivos · Herramientas · Respuestas · Preguntas y permisos · Errores · Latencia
  ```

- El contenido de la pestaña activa se rinde **inmediatamente debajo** del tablist; el tablist es
  el **último** bloque del eje vertical y **no** es `sticky`.
- El scroll principal queda, en este orden, como recorrido continuo y **sin pestañas intercaladas**:
  Identidad → Modelo → Métricas → **Contexto (Paralelismo + Aporte al padre)** → Recursos →
  Duración mediana por herramienta.
  **MUST NOT** omitirse Contexto: el informe de accesibilidad lo omitía por error; prevalece el
  norte (RFC §"Conflictos", punto 8).
- En escritorio el tablist de secciones queda **anidado** dentro del tabpanel `Detalle` del
  tablist externo; en móvil es el único tablist del detalle.
- Ninguna sección existe dos veces: **MUST NOT** haber bloques duplicados entre el resumen y las
  pestañas ni secciones del resumen dentro del área de pestañas.

## §2 ARIA y teclado

- Cada tablist lleva un `aria-label` **propio y distinto**:
  - externo: `Vistas del panel de detalle` (sin cambios);
  - interno: `Secciones técnicas del nodo`.
- **Prohibido** pasar `id` fijos o ARIA manual (`role`, `aria-controls`, `aria-selected`): Radix los
  genera con `useId`.
- Cada pestaña es `role="tab"` con `aria-controls` a su panel; cada panel es `role="tabpanel"` con
  `aria-labelledby` a su pestaña. Los inactivos quedan `hidden` y **sin hijos montados**.
- **Prohibido** `role="region"` dentro de los paneles (el `role="region"` que introducía el
  desplegable "Avanzado" desaparece sin equivalente; lo sustituye el patrón `tab`/`tabpanel`).
- **Prohibido** poner utilidades de `display` (`block`, `flex`, `grid`, …) en el `className` de un
  `TabsContent`: anulan `[hidden]` y expondrían los siete paneles (1.3.1 / 2.4.3).
- Teclado: ←/→ mueven la selección y la **activan** (activación automática); `Tab` entra al tablist
  y de ahí al panel activo; `Inicio`/`Fin` van a la primera/última. `orientation` horizontal
  aunque la lista envuelva (`ArrowUp`/`ArrowDown` no navegan entre filas y **MUST NOT** ponerse
  `orientation="vertical"`).
- `activationMode` permanece **automático** (coherente con el tablist externo y con
  `decision/scroll-y-activacion`).

## §3 Contrato interno del panel (`InspectorSectionTabs`)

```ts
// src/Domains/Inspector/Hooks/useInspectorSectionTabs.ts
type TInspectorSectionTab =
  | 'subagents' | 'files' | 'tools' | 'answers' | 'questions' | 'errors' | 'latency';

interface TInspectorSectionTabItem { id: TInspectorSectionTab; label: string }

useInspectorSectionTabs(
  initialTab?: TInspectorSectionTab, // por defecto 'subagents'
): {
  tab: TInspectorSectionTab;                              // efímero, no persistido
  setTab: (tab: TInspectorSectionTab) => void;             // ignora ids inválidos
  tabs: readonly TInspectorSectionTabItem[];               // 7 items, en orden
}
```

```ts
// src/Domains/Inspector/Components/InspectorSectionTabs.tsx
interface InspectorSectionTabsProps {
  /** Una entrada por pestaña (Record exhaustivo por tipo). */
  sections: Record<TInspectorSectionTab, ReactNode>;
}
```

- **Presentación pura**: el componente no conoce datos del dominio ni hace fetching; el estado
  activo sale del hook y las secciones llegan ya construidas por `InspectorPanel`.
- El `Record` es **exhaustivo por tipo**: añadir una pestaña obliga a aportar su sección.
- Constantes centralizadas (sin magic strings): `INSPECTOR_SECTION_TAB_ITEMS`,
  `INSPECTOR_SECTION_TABS_ARIA_LABEL`, `INSPECTOR_SECTION_TABS_LIST_CLASSNAME`.
- El `TabsContent` del call site usa `className="min-w-0 cursor-default mt-3"` (el primitivo trae
  `cursor-pointer`, incorrecto sobre contenido de panel; `twMerge` lo resuelve sin `!`).
- El `className` de cada sección conserva **literalmente** sus props actuales
  (`renderCompactionContext`, `onOpenHistory`, `threshold`/`onThresholdChange`, `sessionId`,
  `parallelPeers`, `invokedBy`, …).

## §4 Estado de la pestaña

- Estado **efímero**, no persistido (ni `localStorage` ni caché de Query).
- Valor inicial **`subagents`** (FR-003).
- **MUST** mantenerse al cambiar de nodo y **MUST** volver a `subagents` al cerrar y reabrir el
  detalle (implementado por el límite de montaje del componente, ver `research.md` R1).
- La selección **MUST NOT** depender de datos del nodo ni alterarlos.

## §5 Estados de cada panel

- Cada panel resuelve, en este orden, **error → carga → vacío → datos** (Principio VI):

  | Sección | Error | Carga | Vacío |
  |---|---|---|---|
  | Subagentes | `EmptyScreenError` | `ListSkeleton` | "Sin subagentes ni agentes en paralelo." |
  | Archivos | `EmptyScreenError` | `Skeleton` | estado vacío propio |
  | Herramientas | `EmptyScreenError` | `ListSkeleton` | "Sin actividad de herramientas todavía." |
  | Respuestas | `EmptyScreenError` | `ListSkeleton` | "Sin respuestas todavía" (semántica vigente, no excluyente con la lista) |
  | Preguntas y permisos | `EmptyScreenError` | `Skeleton` | "Sin permisos ni preguntas" |
  | Errores | `EmptyScreenError` | `ListSkeleton` | "Sin errores." |
  | Latencia | `EmptyScreenError` | `Skeleton` | estado vacío propio |

- Las cuatro secciones sin estado propio (Subagentes, Herramientas, Respuestas, Errores) **MUST**
  recibir `isLoading`/`isError` de la query de mensajes de `useInspectorData`.
- **MUST NOT** mostrarse el estado vacío mientras la fuente está en carga o en error (SC-005).
- Cada panel conserva el encabezado interno de su sección (rótulo de texto, sin promoverlo a
  encabezado semántico en este cambio).
- La pestaña de **Latencia** conserva la sección completa: referencia de umbral, control del
  umbral y listado de respuestas medidas con sus anomalías. Las anomalías **MUST NOT** filtrar ni
  deshabilitar la sección.

## §6 Presentación, foco y contraste del primitivo compartido (`src/Application/Components/ui/tabs.tsx`)

Aplica a **todo** uso del primitivo, incluido el tablist externo `Detalle | Chat`.

- **Alto y envoltura**: `TabsList` usa `min-h-control` (no `h-control`) y `flex-wrap`. Una lista
  que cabe en una fila conserva el alto de control actual; una lista restringida en ancho envuelve
  en filas. El uso que necesita envolver y ancho completo es el call site
  (`INSPECTOR_SECTION_TABS_LIST_CLASSNAME = 'w-full justify-start gap-1'`); **MUST NOT**
  duplicarse el override de alto desde el call site.
- **Etiquetas**: los triggers son `whitespace-nowrap`; **MUST NOT** truncarse, abreviarse ni exigir
  desplazamiento horizontal. Objetivo de las pestañas ≥24×24 (paridad visual con "Detalle | Chat";
  no se agranda solo en la sección).
- **Indicador de estado activo**: además de la píldora (`bg-background`), un indicador con
  separación **≥3:1** contra el fondo adyacente (1.4.11). La píldora sola da 1.31:1 en oscuro y
  1.10:1 en claro. El indicador **MUST** seguir siendo perceptible en `forced-colors` (no puede
  depender solo de `box-shadow`).
- **Foco**: visible mediante `outline` (2.4.7), con respaldo
  `forced-colors:outline-[Highlight]`; patrón del proyecto (`ui/input.tsx:14`). **MUST NOT**
  depender de `ring`/`box-shadow` ni de `focus-visible:outline-none`.
- **Texto inactivo**: ≥4.5:1 en el tema servido. En claro hoy es 4.39:1; **MUST NOT** modificarse
  ningún token compartido de color en este cambio (queda latente y registrado, FR-007).

## §7 Superficie congelada y limpieza documental

- **MUST NOT** cambiar: contrato del tablist externo `Detalle | Chat` (comportamiento, etiqueta,
  orden, `ChatAttentionBadge`), rutas, `queryKeys.ts`, `Inspector.service.ts`, tipos del SDK,
  copy/etiquetas de las siete secciones, `Disclosure` (se conserva: lo usa `ToolHistory`).
- **MUST** eliminarse: `AdvancedSection.tsx` y su spec, y el export del barrel. El desplegable
  "Avanzado" deja de existir.
- **MUST** dejar de describir el desplegable "Avanzado" (alcance acotado de FR-010):
  1. `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md` — §1 ítem 7, §2.1-2.3,
     §3.1 (`AdvancedSection`) y §5:157 ("Archivos solo cambia de posición").
  2. `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58`.
  El resto de documentos de `specs/004` (spec/plan/tasks/quickstart/data-model/research) queda
  **histórico** y **MUST NOT** reescribirse.
- **Prohibido**: renombrar secciones o etiquetas, añadir contadores/insignias a las pestañas,
  persistir la pestaña activa, añadir una lista de destinos adicional en móvil.

## §8 Contrato de regresión (specs)

- `useInspectorSectionTabs.spec.tsx`: 7 items y su orden, inicial `subagents`, `setTab` cambia e
  ignora ids inválidos, `tabs` referencialmente estable.
- `InspectorSectionTabs.spec.tsx`: APG (roving tabindex, `aria-controls`/`aria-labelledby`,
  ←/→ y `Inicio`/`Fin` con 7 pestañas), **un solo** tabpanel con hijos, 6 `hidden` sin hijos,
  envoltura (`flex-wrap` en la lista), `aria-label` propio y `data-testid`.
- `tabs.a11y.spec.tsx` (primitivo, ampliado): fixture **anidado** (dos tablists con labels
  distintos e ids únicos), 7 pestañas → 6 paneles `hidden` sin hijos, `Inicio`/`Fin` con 7,
  guardias de clase (`flex-wrap`, `min-h-control`), foco por `outline` + `forced-colors` e
  indicador activo con clase de contraste.
- `InspectorPanel.spec.tsx`: el bloque del desplegable "Avanzado" (`206-420`) se reescribe: ya no
  hay `aria-expanded` ni `role="region"`; las consultas por texto de las etiquetas de pestaña
  pasan a `getByRole('tab')`/`getByRole('tabpanel')`/`data-testid`, y las props de cada sección se
  verifican con stubs.
- Specs con queries globales (`InspectorPane.spec.tsx`, `WorkspaceLayout.spec.tsx`,
  `WorkspaceMobileTabs.spec.tsx`): acotadas con `within`/`aria-label` o `data-testid`; se mantiene
  el stub de `InspectorPanel` donde ya exista.
- Specs obligatorios de las cuatro secciones con estados: `isError` muestra error (nunca vacío),
  `isLoading` muestra carga (nunca vacío), y el vacío legítimo sigue tras resolverse la fuente.
