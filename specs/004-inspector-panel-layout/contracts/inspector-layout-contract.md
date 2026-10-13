# Contract — Inspector panel layout

**Feature**: `004-inspector-panel-layout`
**Componente orquestador**: `src/Domains/Inspector/Components/InspectorPanel.tsx`

Este contrato fija el comportamiento observable del panel de detalles. Es verificable
con tests de Testing Library (orden del DOM, contenido montado/desmontado).

---

## 1. Orden de secciones (FR-001, FR-002, SC-003)

Con un nodo seleccionado, el panel se compone **exactamente** en este orden de arriba a abajo:

```
0. Identidad         (cabecera: título, agente, estado, directorio, invocado por)  [FR-002]
1. Modelo                                                                          [FR-003]
2. Métricas          (incluye LoopBadge si metrics.hasLoop)                        [FR-004]
3. Recursos                                                                        [FR-005]
4. Duración mediana por herramienta                                                [FR-006]
5. Subagentes        (tareas + agentes en paralelo)                                [FR-007/008]
6. Archivos                                                                        [FR-009]
7. Secciones técnicas (tablist al final; ya no hay desplegable "Avanzado")         [FR-010 → 014]
```

> **Superseded (`014-inspector-detail-tabs`, FR-010).** El desplegable "Avanzado" (ítem 7) ya no
> existe. Las secciones técnicas del detalle pasan a un **tablist** al final del detalle; contrato
> vigente: `specs/014-inspector-detail-tabs/contracts/inspector-section-tabs-contract.md`.

**Invariantes**:
- La cabecera de identidad (0) nunca forma parte del bloque reordenado y permanece la primera (FR-002).
- El orden se corresponde 1:1 con el DOM; no se usan órdenes visuales (`order-*`, `flex-col-reverse`) que difieran del DOM.
- Sin nodo seleccionado se mantiene el mensaje actual: `"Selecciona un nodo del grafo para ver su detalle."`

---

## 2. Desplegable "Avanzado" — SUPERSEDED

> **Superseded (`014-inspector-detail-tabs`, FR-010).** El desplegable "Avanzado" ya no existe: su
> comportamiento (§2.1), su accesibilidad por `aria-expanded`/`aria-controls`/`role="region"` (§2.2)
> y sus subsecciones (§2.3) quedan sustituidos por el **tablist de secciones técnicas** del detalle.
> Contrato vigente: `specs/014-inspector-detail-tabs/contracts/inspector-section-tabs-contract.md`.

---

## 3. Contratos de componentes nuevos

### 3.1 `AdvancedSection` — SUPERSEDED

> **Superseded (`014-inspector-detail-tabs`, FR-010).** `AdvancedSection` se elimina: el desplegable
> "Avanzado" y su contrato de props dejan de existir. Las secciones técnicas se montan ahora en un
> **tablist**; contrato vigente:
> `specs/014-inspector-detail-tabs/contracts/inspector-section-tabs-contract.md` §3. (`Disclosure` se
> conserva como pieza compartida.)

### 3.2 `ToolStats`

```ts
interface ToolStatsProps {
  tools: TToolHistoryEntry[];
  isEmptyLabel?: string; // default: "Sin actividad de herramientas todavía."
}
```

- Encabezado visible: `Duración mediana por herramienta`.
- Por fila: `` `${stat.name} · ${callsLabel(stat.calls)}` `` + `formatDuration(stat.medianMs)` o `"no disponible"` si `medianMs === null` (FR-006).
- Sin herramientas → estado vacío explícito.

### 3.3 `SubagentsSection`

```ts
interface SubagentsSectionProps {
  tasks: TTaskEntry[];
  parallelPeers: TGraphNode[];
}
```

- Encabezado único visible: `Subagentes`.
- Contenido: tareas (estado + descripción) y peers (`StatusDot` + título).
- `tasks` y `parallelPeers` vacíos → estado vacío explícito (FR-008).

### 3.4 `ErrorsSection`

```ts
interface ErrorsSectionProps {
  errors: { message: string; at: number }[];
}
```

- Encabezado visible: `Errores`.
- `errors` vacío → `"Sin errores."` (FR-015).
- Cada error con estilo `text-status-error`.

### 3.5 `ModelSection`

```ts
interface ModelSectionProps {
  model: TGraphNode['data']['model'];
}
```

- Encabezado visible: `Modelo`.
- Filas: `Nombre` = `providerID/id` o `UNAVAILABLE`; `Razonamiento` = variante o `UNAVAILABLE` (FR-003).

---

## 4. Estados de pantalla (FR-016, Principio VI)

Ninguna sección pierde su ciclo **error → loading → vacío → datos**:

| Sección | Error | Loading | Vacío | Datos |
|---------|-------|---------|-------|-------|
| Modelo | — (datos del nodo) | — | "no disponible" por campo | filas |
| Métricas | — (datos del nodo) | — | valores "no disponible" | métricas |
| Recursos | — | — | "Sin recursos configurados…" | filas |
| Duración mediana | — | — | estado vacío explícito | `TToolStat[]` |
| Subagentes | — | — | estado vacío explícito | tareas + peers |
| Archivos | `EmptyScreenError` | `Skeleton` | estado vacío | lista + parche |
| Herramientas | — | — | "Sin actividad…" | ejecuciones |
| Respuestas | — | — | "Sin respuestas todavía" | entradas |
| Preguntas y permisos | `EmptyScreenError` | `Skeleton` | "Sin permisos ni preguntas" | permisos/preguntas/cola |
| Errores | — | — | "Sin errores." | lista |

---

## 5. Fuera de contrato (no cambia)

- Obtención de datos: `useInspectorData`, `Inspector.service.ts`, SDK, eventos SSE.
- Tipos del dominio: `Inspector.entity.ts` no gana ni cambia tipos.
- Cabecera de identidad y sección Archivos: la cabecera conserva su contenido; **Archivos** pasa a una
  **pestaña** del tablist (ya no comparte el scroll del resumen), sin cambios de contenido
  (`014-inspector-detail-tabs`, FR-010).
