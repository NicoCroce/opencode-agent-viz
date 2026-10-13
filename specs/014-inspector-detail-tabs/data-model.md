# Phase 1 — Data Model: Detalle del nodo por secciones (tablist) en el Inspector

**Feature**: `014-inspector-detail-tabs` | **Date**: 2026-10-13 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

No hay datos nuevos ni cambios de forma en los datos existentes: la feature reordena
presentación. El modelo describe las **piezas de vista** que introduce (pestaña, item de
pestaña, mapa de secciones, estado efímero) y las invariantes que el contrato exige.

## 1. Entidades

| Entidad | Origen | Campos | Notas |
|---|---|---|---|
| `TInspectorSectionTab` | `Domains/Inspector/Hooks/useInspectorSectionTabs.ts` | unión `'subagents' \| 'files' \| 'tools' \| 'answers' \| 'questions' \| 'errors' \| 'latency'` | Orden fijo de FR-001; deriva de `INSPECTOR_SECTION_TABS` (`as const`) |
| `TInspectorSectionTabItem` | idem | `{ id: TInspectorSectionTab; label: string }` | Etiquetas exactas: Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia (FR-005: sin renombrar) |
| `TUseInspectorSectionTabsResult` | idem | `{ tab: TInspectorSectionTab; setTab(tab): void; tabs: readonly TInspectorSectionTabItem[] }` | Estado efímero (FR-003) |
| Mapa de secciones | `InspectorPanel.tsx` | `Record<TInspectorSectionTab, ReactNode>` | Exhaustivo por tipo: añadir una pestaña obliga a aportar su sección (TS estricto) |
| `InspectorSectionTabs` | `Domains/Inspector/Components/InspectorSectionTabs.tsx` | renderiza `Tabs` + `TabsList` + 7 `TabsTrigger` + 7 `TabsContent`, `children` del panel activo = entrada del mapa | Presentación pura; consume el hook (R1/R2) |
| `TLatencyReport`, `TTaskEntry`, `TToolHistoryEntry`, `THistoryEntry`, `TSessionDiffResult`, `TSessionFormsResult`, `TSessionPermissionsResult`, `TSessionInboxResult` | dominio Inspector / Graph (ya existen) | sin cambios | La feature **no** toca su forma, su origen ni su lógica (FR-009 y assumptions) |

Ninguna entidad nueva redefine tipos del SDK (constitución IV): todas son tipos de vista del
dominio Inspector.

## 2. Relación entre el estado y el ciclo de vida del detalle (FR-003)

| Evento | Efecto en `tab` | Mecanismo |
|---|---|---|
| Montaje con nodo | `tab = 'subagents'` | `useState(INSPECTOR_SECTION_TAB_ID)` |
| Selección de otra pestaña (puntero o teclado) | `tab = <elegida>` | `setTab` (guarda de id válido) |
| Cambio de nodo A→B | **sin cambio** | `InspectorSectionTabs` sigue montado en la misma posición |
| `node = null` (cierre del detalle) | — | `InspectorPanel` retorna `InspectorEmptyPrompt` ⇒ desmonta `InspectorSectionTabs` |
| Reapertura del detalle | `tab = 'subagents'` | remontaje del componente |
| Re-render por SSE / enriquecimiento | **sin cambio** | el estado es local al componente; no se deriva de datos |
| Recarga de la app | `tab = 'subagents'` | no hay persistencia |

**Invariante**: existe exactamente una pestaña activa en todo momento y es una de las siete; la
única forma de restaurar el valor inicial es desmontar y volver a montar la lista.

## 3. Máquina de estados de cada panel (FR-008, Principio VI)

`SectionFrame` resuelve, en este orden, `isError → isLoading → isEmpty → children`.

```text
[panel activo]
  isError   → <EmptyScreenError />            (o nodo `error` propio)
  isLoading → <ListSkeleton />                (o nodo `loading` propio)
  isEmpty   → estado vacío explícito          (texto propio de la sección)
  datos     → contenido de la sección

[panel inactivo]
  div[role=tabpanel][hidden] sin hijos montados  (Radix, R6)
```

| Sección (pestaña) | Fuente de estado | `isError`/`isLoading` hoy | Tras la feature |
|---|---|---|---|
| Subagentes | `useInspectorData` (`tasks`, `isError`, `isLoading`) | no expuestos | **sí** (FR-008) |
| Archivos | `TSessionDiffResult` propio | ya expuestos (`InspectorPanel.tsx:156-160`) | sin cambios |
| Herramientas | `useInspectorData` (`tools`, `isError`, `isLoading`) | no expuestos | **sí** (FR-008) |
| Respuestas | `useInspectorData` (`entries`, `isError`, `isLoading`) + contexto de compactación propio | no expuestos | **sí** (FR-008); la cabecera (toggle de razonamiento) y "Ver histórico completo" siguen montados (R7) |
| Preguntas y permisos | `forms` + `permissions` + `inbox` | ya expuestos | sin cambios (FR-005) |
| Errores | `useInspectorData` (`errors`, `isError`, `isLoading`) | no expuestos | **sí** (FR-008) |
| Latencia | `contextMetrics` (con `useContextMetrics`) | ya expuestos | sin cambios; contenido completo (FR-009) |

**Invariante de estado (SC-005)**: un panel **no** puede mostrar su estado vacío mientras su
fuente está en carga o en error.

## 4. Estructura del detalle (FR-004, contrato §2.1)

```text
InspectorPanel (scroll principal, `Container overflow-auto p-4`)
├── Identidad
├── Modelo
├── Métricas
├── Contexto ── (Paralelismo, Aporte al padre)          ← permanece (prevalece el norte)
├── Recursos
├── Duración mediana por herramienta
└── InspectorSectionTabs
    └── TabsList [aria-label="Secciones técnicas del nodo"]  (7 pestañas, envuelve en filas)
        └── TabsContent (solo el activo monta hijos)
            └── sección técnica: encabezado interno + estados + contenido
```

- **Prohibido** cualquier bloque duplicado entre el resumen y las pestañas (SC-002).
- Cada sección conserva su encabezado interno como rótulo de texto, sin promoverlo a encabezado
  semántico (resuelto en Clarifications; queda como hallazgo fuera de alcance).
- El tablist es el **último** bloque del eje vertical; no es `sticky` y no introduce estado de
  scroll propio.

## 5. Reglas de validación (derivadas de las FR)

| Regla | FR | Comprobación |
|---|---|---|
| 7 pestañas, en orden exacto y sin renombrar | FR-001, FR-005 | `INSPECTOR_SECTION_TAB_ITEMS.map(id/label)`; spec del hook + spec del componente |
| Exactamente una activa; las otras seis no montan hijos | FR-002 | `aria-selected` (1 verdadero) + `getAllByRole('tabpanel', { hidden: true })` con 6 `hidden` y sin hijos |
| Inicial `subagents`; sin persistencia; se mantiene entre nodos | FR-003 | spec del hook (`initial`) + spec del componente (remontaje ⇒ vuelve a Subagentes) |
| El resumen no contiene pestañas y las 7 secciones salen de él | FR-004 | spec del panel: orden Modelo→…→ToolStats y `getByRole('tablist', { name: 'Secciones técnicas del nodo' })` después |
| Etiqueta del tablist propia y distinta de la externa | FR-013 | `aria-label` interno `'Secciones técnicas del nodo'` ≠ externo `'Vistas del panel de detalle'` |
| Ninguna etiqueta se corta; la lista envuelve; sin scroll horizontal | FR-006 | guardias de clase (`flex-wrap` en el primitivo; `w-full justify-start gap-1` en el call site) + `whitespace-nowrap` en los triggers |
| Selección con puntero y teclado (←/→, Inicio/Fin); foco visible | FR-007 | spec APG del primitivo (7 pestañas, Home/End) + `outline-*` y `forced-colors:outline-[Highlight]` |
| Las 4 secciones sin estado muestran error y carga | FR-008 | specs de las 4 secciones con `isError`/`isLoading` |
| Latencia completa y operativa con anomalías | FR-009 | spec vigente de `LatencySection` (sin cambios) |
| Sin badges ni contadores | `decision/sin-badges` | los `TabsTrigger` solo rinden su etiqueta |
| Latencia, Contexto y el resto de props llegan literalmente | FR-005/FR-009 | `InspectorPanel.spec` con stubs de sección y aserciones de props |
| "Detalle \| Chat" no cambia de comportamiento | FR-011 | specs vigentes de `InspectorPane` verdes (solo se acotan queries) |

## 6. Fuera del modelo

Sin claves de caché nuevas, sin consultas nuevas, sin persistencia, sin rutas, sin tipos del SDK
redefinidos, sin cambios en `queryKeys.ts`, `Inspector.service.ts` ni `Graph.entity.ts`.
`AdvancedSection` desaparece del modelo (y del código); `Disclosure` permanece como pieza de
`ToolHistory`.
