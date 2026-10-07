# Contract — Inspector panel layout

**Feature**: `004-inspector-panel-layout`
**Componente orquestador**: `src/Domains/Inspector/Components/InspectorPanel.tsx`

Este contrato fija el comportamiento observable del panel de detalles. Es verificable
con tests de Testing Library (orden del DOM, `aria-expanded`, contenido montado/desmontado).

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
7. Avanzado          (disclosure, colapsado por defecto)                           [FR-010]
```

**Invariantes**:
- La cabecera de identidad (0) nunca forma parte del bloque reordenado y permanece la primera (FR-002).
- El orden se corresponde 1:1 con el DOM; no se usan órdenes visuales (`order-*`, `flex-col-reverse`) que difieran del DOM.
- Sin nodo seleccionado se mantiene el mensaje actual: `"Selecciona un nodo del grafo para ver su detalle."`

---

## 2. Desplegable "Avanzado" (FR-010, FR-011, FR-012, SC-002)

### 2.1 Comportamiento

| Aspecto | Contrato |
|---------|----------|
| Estado inicial | **Colapsado** por defecto. |
| Contenido colapsado | Las subsecciones **no se montan** (render condicional); no aparecen en el DOM. |
| Acción | Un único control explícito (botón) alterna expandir/colapsar. |
| Contenido expandido | Subsecciones en este orden: Herramientas → Respuestas → Preguntas y permisos → Errores. |
| Colapsar | El contenido vuelve a desaparecer y el resto del panel no cambia de orden. |
| Persistencia | El estado se conserva entre cambios de nodo mientras el panel siga montado; se reinicia al abrir la app. |

### 2.2 Accesibilidad

| Requisito | Contrato |
|-----------|----------|
| Nombre accesible del control | `Avanzado`. |
| `aria-expanded` | `false` colapsado; `true` expandido. |
| `aria-controls` | Referencia al `id` de la región de contenido. |
| Región | `role="region"` con `aria-label="Avanzado"` (o encabezado asociado) y el `id` referenciado. |

### 2.3 Subsecciones (orden interno fijo, FR-011)

1. **Herramientas** — `ToolHistory` con las ejecuciones y su control "Ver N más". **No** incluye el bloque de mediana (FR-013).
2. **Respuestas** — `AnswersSection` sin cambios: entradas conversacionales cronológicas, toggle de razonamiento y botón "Ver histórico completo" (FR-014).
3. **Preguntas y permisos** — `QuestionsSection` sin cambios: permisos, preguntas y turnos en cola (FR-011).
4. **Errores** — `ErrorsSection`; vacío → `"Sin errores."` (FR-015).

---

## 3. Contratos de componentes nuevos

### 3.1 `AdvancedSection`

```ts
interface AdvancedSectionProps {
  /** Fuerza el estado inicial/servidor; por defecto no controlado (colapsado). */
  defaultExpanded?: boolean;  // default: false
  /** Modo controlado opcional (no usado por defecto en esta feature). */
  expanded?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;  // subsecciones, en el orden fijado por el llamador
}
```

- **Puro/controlado opcional**: sin `expanded` gestiona su propio `useState(false)` (R3/R6).
- No conoce datos del dominio; solo envuelve contenido.
- Delega en los hijos sus propios estados de error/loading/vacío (no los intercepta).

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
- Cabecera de identidad y sección Archivos: solo cambian de posición, no de contenido.
