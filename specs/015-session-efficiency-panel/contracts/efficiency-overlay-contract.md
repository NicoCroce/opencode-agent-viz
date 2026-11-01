# Contrato — Overlay de eficiencia de sesión

**Feature**: `015-session-efficiency-panel` | **Fecha**: 2026-10-23
**Plan**: [../plan.md](../plan.md) · **Modelo**: [../data-model.md](../data-model.md)
**Motor**: [efficiency-engine-contract.md](./efficiency-engine-contract.md)

Este contrato fija la superficie de UI, accesibilidad, integración y privacidad del panel. Es la
fuente de verdad para los specs de componente e integración.

## 1. Acceso y ubicación

- El panel se abre **solo** desde la cabecera de la sesión en el grafo (`GraphPane`), con un botón
  `Eficiencia` situado **antes** de `Seguir` (FR-001/FR-047). El botón se monta cuando el grafo tiene
  al menos un nodo (sesión con datos); en carga, error, no encontrada o “sin agentes” no hay sesión
  que analizar y no se muestra.
- No hay 8.ª pestaña en el Inspector (spec 014 fija 7), ni ruta nueva, ni entrada desde el rail de
  sesiones.
- El botón:
  - `variant="outline"`, texto visible `Eficiencia` en escritorio.
  - En móvil: solo icono (`faChartLine`) con `aria-label="Abrir análisis de eficiencia"`.
  - `aria-haspopup="dialog"`.
  - `onClick` llama a `onOpenEfficiency(event.currentTarget)` para guardar el disparador.
- El panel se cierra con el botón visible “Cerrar”, con `Escape` y con el cierre modal de Radix
  (backdrop, si aplica). Al cerrarse, el foco vuelve al disparador (FR-005).

## 2. Composición y slots

```text
WorkspacePage
├── useEfficiencyPanel({ rootSessionId })
├── buildEfficiencySessions(graph.graph)   // puro, Infrastructure
├── <GraphPane onOpenEfficiency={...} isMobile={...} />
├── <InspectorPane onOpenHistory={...} />  // wrapper de exclusión mutua
├── <WorkspaceView efficiency={<EfficiencyOverlay ... />} history={<HistoryOverlay ... />} />
└── useWorkspaceEscape({ ..., isDialogOpen: efficiency.isOpen })

EfficiencyOverlay (Infrastructure)
├── Radix Dialog Root/Portal/Overlay/Content
├── header (título, descripción, Cerrar)
└── body
    ├── loading → EfficiencySkeleton
    ├── error sin datos → EmptyScreenError
    ├── no_data → EmptyState
    └── EfficiencyReport (dominio)
```

- `WorkspaceView` y `WorkspaceLayout` reciben `efficiency?: ReactNode` y lo renderizan en móvil y
  escritorio, junto a `history`.
- Props de `EfficiencyOverlay`:
  ```ts
  interface TEfficiencyOverlayProps {
    isOpen: boolean;
    rootSessionId: string;
    rootTitle: string | null;
    sessions: Record<string, TEfficiencySessionMeta>;
    rootReady: boolean;
    truncated: boolean;
    graphError: boolean;
    now: number | null;                  // openedAt del panel
    reference: TEfficiencyReference | null; // summary.metrics (contraste, opcional)
    onClose: () => void;
    onRestoreFocus: () => void;
  }
  ```
  `TEfficiencyReference` es un subconjunto estructural de `TNodeMetrics` (`cost` y `tokens`), no un
  import cross-domain desde el componente.
- **Exclusión mutua** (FR-006): abrir eficiencia cierra el histórico; abrir el histórico cierra
  eficiencia. Solo una capa de este tipo puede estar abierta.
- `Escape`:
  - Con el diálogo abierto, Radix lo consume y cierra; `useWorkspaceEscape` **no** registra su
    listener (`isDialogOpen: true`) para no limpiar la selección del grafo por debajo.
  - Sin el diálogo, el comportamiento actual del workspace no cambia.
- El estado de vista es efímero, sin persistencia (no `localStorage`). Un cambio de sesión raíz
  cierra el panel.

## 3. Diálogo, ARIA y foco

- Se usa **Radix Dialog** (`@radix-ui/react-dialog` 1.1.x, instalado 1.1.23; ya es dependencia). No
  se usa el `div role="dialog"` de `HistoryModal` ni el `DialogContent` centrado de
  `ui/dialog.tsx`.
- El contenido es un `DialogPrimitive.Content` **full-screen**:
  - `fixed inset-0 z-50` y fondo opaco `bg-surface-1`.
  - `Dialog.Title` visible: “Eficiencia de la sesión”.
  - `Dialog.Description` visible o sr-only: “Análisis de solo lectura de la sesión y su subárbol.”
  - El nombre accesible del diálogo es el título; los tests usan
    `getByRole('dialog', { name: 'Eficiencia de la sesión' })`.
- Radix aporta `role="dialog"`, `aria-modal="true"`, focus trap, `Escape`, scroll-lock y
  `aria-describedby`.
- `onCloseAutoFocus`:
  - `preventDefault()`.
  - Si el disparador guardado sigue en `document`, `focus()`; si no, no se fuerza un foco inválido.
  - `open(trigger)` guarda `event.currentTarget`; `useEfficiencyPanel` expone `restoreFocus()`.
- El foco inicial va al primer elemento focusable del diálogo (botón “Cerrar” o el título con
  `tabIndex` si hace falta); `Tab`/`Shift+Tab` ciclan dentro.
- El scroll del body queda bloqueado por Radix mientras el diálogo está abierto.
- El botón “Cerrar”:
  - `variant="outline"`, texto `Cerrar`, `aria-label="Cerrar análisis de eficiencia"`.
  - Objetivo táctil ≥24×24 px (el `Button` del proyecto ya usa `h-control`).
- No hay `aria-live` para el veredicto (no es una alerta); los banners de estado usan
  `role="status"`.

## 4. Estados (FR-036/FR-037)

El informe es una **unidad de datos**; los estados error/carga se resuelven antes de los bloques:

| Estado | Condición | Render |
|---|---|---|
| Cerrado | `isOpen = false` | Radix no monta el contenido; no se ejecuta el hook |
| Carga | `isLoading && !report` | `EfficiencySkeleton` + `role="status"` “Cargando análisis…” |
| Error | `isError && !report` | `EmptyScreenError` con mensaje “No se pudo cargar la sesión.”; el header y “Cerrar” siguen |
| Vacío | `report.status === 'no_data'` | `EmptyState` “Sin mensajes” / “Esta sesión todavía no reportó mensajes.” |
| En curso | `report.status === 'in_progress'` | Banner `role="status"` “Sesión en curso: sin nota”; cobertura, totales y turnos crudos; sin veredicto, valores de dimensión ni hallazgos |
| Insuficiente | `report.status === 'insufficient'` | Banner “Muestra insuficiente” + motivo (turnos y/o cobertura); cobertura, dimensiones omitidas, conteos y totales; sin veredicto, valores de dimensión ni hallazgos |
| Datos | `report.status === 'ok'` | Veredicto + factores + hallazgos + señales + turnos + cómo se calcula + totales |
| Parcial | `isPartial` | Banner `role="status"` “Análisis parcial: N sesiones sin datos”; el informe sigue visible |
| No actualizado | `isError && report` | Banner `role="status"` “No se pudieron actualizar los datos; se muestra el último análisis.”; el informe sigue visible |

- Los bloques derivados (veredicto, hallazgos, turnos, totales, cómo se calcula) declaran su
  **vacío** explícito (“Sin hallazgos”, “Sin señales débiles”, “Sin turnos”, “No disponible”).
  No tienen consulta propia, así que no inventan estados de carga/error por bloque; el estado
  global ya los cubre. Un fallo de actualización con datos previos nunca oculta el informe
  (FR-037). `isError` proviene de `graph.isError`, no de una consulta de red propia.
- Un dato ausente se muestra como “no disponible” (`UnavailableValue`/`format*`), nunca como 0 ni
  como 100.
- El truncamiento del grafo (`graph.truncated`) añade un banner/nota “El grafo está truncado:
  faltan agentes del subárbol.”; no se inventan mensajes.

## 5. Layout y contenido

### 5.1 Header

- Título “Eficiencia de la sesión”.
- Subtítulo: “Solo lectura · {n} agentes” o el título de la sesión si existe.
- “Cerrar” a la derecha.
- En móvil, el header envuelve (`flex-wrap`) sin scroll horizontal.

### 5.2 Veredicto (US1)

- Nota entera grande (≥2rem) con `aria-label="{score} de 100, {banda}"`; banda con texto + icono
  (no solo color; sin rojo).
- Cobertura y confianza visibles (`formatPercent(coverage, 1)` si es fraccionaria; etiqueta
  “confianza {alta|media|baja}”).
- 2–3 **factores** de mayor impacto (`EfficiencyFactors`): etiqueta, conteo y signo
  (`resta`/`suma`), con la dimensión a la que pertenecen. Los puntos exactos se explican en
  “Cómo se calcula”; la tarjeta no inventa una cifra que no sume.
- Control `Disclosure` “Cómo se calcula” (ver §5.5).
- Si `score === null` (en curso/insuficiente), no se pinta la nota ni los valores de dimensión; se
  pinta el banner de estado, la cobertura y los datos crudos.

### 5.3 Hallazgos (US2)

- Primero los `findings` penalizantes, ordenados por el motor; se muestran **2–5** por impacto y el
  resto bajo un `Disclosure` “Ver N hallazgos más” (FR-025/UX).
- Cada `EfficiencyFindingCard`:
  - `ruleId` estable + severidad (texto + icono).
  - Condición medida (`condition`).
  - Cita con turno/mensaje/tool/hora; el texto se recorta a **120 code points** en colapsado.
  - Si la cita es más larga, `Disclosure` “Ver cita completa” que monta el texto completo **solo**
    al expandir. Nunca tooltip, nunca botón de copia (FR-030).
  - Recomendación específica.
- Las `weakSignals` van en una sección aparte, con la etiqueta “Señales (no restan)”; nunca se
  mezclan con los hallazgos ni alteran la nota (FR-019/FR-026).
- Sin hallazgos: “Sin hallazgos” (no un hueco).
- El panel no compara sesiones ni muestra rankings (FR-020).

### 5.4 Turnos (US3/US5)

- **Escritorio** (`isMobile === false`): `EfficiencyTurnTable`.
  - `<table>` con `<caption>` (visible o sr-only) “Turnos de la sesión”.
  - Columnas: Turno, Pedido, Aclaraciones, Resultado, Coste, Tiempo, Señales.
  - `scope="col"` en los encabezados.
  - Cada fila tiene un botón “Ver detalle”/“Ocultar detalle” con `aria-expanded` y
    `aria-controls` (solo cuando está expandida).
  - El prompt se recorta a 120 code points; si es corto, no hay botón de expansión. La fila
    expandida monta `EfficiencyTurnDetail` con el prompt completo y la evidencia/señales.
  - El turno abierto se marca “abierto” y su tiempo puede ser “—” si no hay `now`.
- **Móvil** (`isMobile === true`): `EfficiencyTurnCards`.
  - Un `<article>` por turno con los mismos campos esenciales y el mismo botón de expansión.
  - Sin tabla ancha ni scroll horizontal de página; `min-w-0`/`break-words`.
  - La expansión muestra el mismo `EfficiencyTurnDetail`.
- La misma sesión en escritorio y móvil produce la misma nota, banda, cobertura y hallazgos; solo
  cambia la presentación (FR-034/SC-010).
- Los turnos de subagentes no se mezclan como pedidos humanos (FR-035): el pedido es siempre el
  `user` de la raíz.

### 5.5 “Cómo se calcula” (FR-016/FR-021)

`Disclosure` con:

- Pesos de las cuatro dimensiones y, solo con `status === 'ok'`, el valor de cada una (0–100 o
  “omitida”). En curso/insuficiente se muestran los pesos, la cobertura y las omisiones, sin valores
  que parezcan una nota.
- Indicadores con conteo, `r`, `cap`, aporte y mínimo; puntos perdidos/ganados.
- Cobertura y su fórmula; dimensiones omitidas con motivo (`TOmission`).
- Regla de confianza (R7) y bandas 85/70/50.
- Notas del motor (parcial, tokens, caché, compactación, turno abierto).
- “Coste y latencia se muestran; no puntúan.”
- Fuente de totales: “derivados de mensajes; no incluyen compactación”.

### 5.6 Totales (FR-017/FR-045)

- Coste, tokens in/out, caché lectura/escritura, ventana de contexto, compactaciones, reintentos,
  errores y llamadas a herramientas.
- Latencia de herramientas: p95 y llamadas >60 s (contexto).
- Contraste opcional con `TSessionSummary.metrics` (`TNodeMetrics`) cuando difiere: “La cabecera
  incluye compactación; el panel no.” No se monta `SessionSummaryBar` dentro del panel ni se
  duplica `MetricsSection`/`ContextSection`/`LatencySection`.
- Los valores ausentes usan “no disponible”.

## 6. Privacidad y seguridad

- Solo lectura: sin escritura, mutación, exportación, copia por defecto ni persistencia (FR-003/
  FR-048).
- Sin envío a servidores, telemetría ni servicios externos. La única lectura es la caché de
  `sessions.messages` y, si falta, la misma consulta de la raíz.
- Los prompts se guardan en memoria local; el completo solo se monta en la región expandida.
- No hay `dangerouslySetInnerHTML`; el texto se renderiza como texto.
- No se muestran comparaciones entre sesiones, percentiles ni rankings.

## 7. Accesibilidad, temas y responsive

- **Teclado**: abrir desde el botón, recorrer con `Tab`, expandir con `Enter`/`Espacio`, cerrar con
  `Escape` y volver al disparador; sin trampas de foco (FR-038/FR-039).
- **Contraste**: 4.5:1 texto; 3:1 elementos no textuales, en claro, oscuro y `forced-colors`. Banda
  y severidad con texto + icono; no solo color.
- **Tabla**: `caption` y `scope="col"`; el estado de expansión se anuncia con `aria-expanded`.
- **Cifras clave**: ≥12 px (`text-xs` o superior).
- **Objetivos táctiles**: ≥24×24 px (recomendado 44×44).
- **320 px**: sin scroll horizontal de página; header y tarjetas envuelven; el veredicto, los
  hallazgos y los turnos siguen legibles.
- **Movimiento**: sin animaciones propias; se respeta `prefers-reduced-motion`; no hay count-up.
- **Temas**: solo tokens (`bg-surface-1`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-muted`); no se hardcodean colores.
- **Forced colors**: iconos SVG + texto; el foco de los `Button` se conserva.

## 8. Flujo de datos y rendimiento

- `useSessionEfficiency` usa `useQueries` sobre `queryKeys.sessions.messages(id)` (clave
  existente) como **observador de caché** (`queryFn: skipToken`, nunca se habilita); no invoca el SDK
  ni hace fetch.
- Raíz: si no está en caché, carga mientras `rootReady` es falso y `no_data` cuando ya está ready;
  subárbol: solo caché y lo ausente se declara parcial (R2). El error lo aporta `graph.isError`.
- El análisis se memoiza por `[idsKey, referencias de mensajes, sessionsKey, now]` y no tickea.
- El contenido se monta solo cuando Radix abre; cerrar no deja trabajo en segundo plano.
- Objetivo: <1 s para 200 mensajes; una pasada O(n) (SC-006).
- No se toca el reducer, el batching, el layout del grafo ni `sameNodeData`.

## 9. Superficie congelada y regresión

- No se modifican `queryKeys`, `buildHistory`, `summarizeSession`, `TGraphNodeData`, `sameNodeData`
  ni la spec 014 (7 pestañas).
- No hay ruta nueva, ni `data-testid` público nuevo, ni dependencia nueva.
- Regresión obligatoria:
  - `GraphPane`: el botón `Seguir` y el resumen de la cabecera siguen funcionando; el nuevo botón
    no desplaza el layout en escritorio.
  - `WorkspaceView`/`WorkspaceLayout`: `history` sigue montándose en ambas presentaciones; el slot
    `efficiency` no altera el layout de tres columnas ni el móvil.
  - `WorkspacePage`: el histórico se sigue abriendo/cerrando; `Escape` sin eficiencia no cambia.
  - Inspector: las 7 pestañas y `Detalle | Chat` no cambian.

## 10. Obligaciones de test

- **Overlay**: `role="dialog"` + nombre accesible; foco atrapado (Tab cicla), `Escape` cierra y el
  foco vuelve al disparador; “Cerrar” cierra; scroll-lock si se puede observar; estados
  carga/error/vacío/datos; banner parcial.
- **Veredicto**: nota, banda, cobertura, confianza, `aria-label` “N de 100, banda”, 2–3 factores con
  conteo y signo; sin nota en curso/insuficiente.
- **Hallazgos**: condición, cita, recomendación, severidad; sin ancla no se muestra; cita recortada
  a 120 code points y completa solo al expandir; señales débiles separadas; cap/“Ver N más”.
- **Turnos**: tabla con caption/scope, orden, expansión, prompt corto sin botón, prompt largo
  recortado/expandido, turno abierto marcado; tarjetas móviles con los mismos datos.
- **Cómo se calcula**: pesos, mínimos, omisiones, cobertura, confianza, bandas, notas, “coste y
  latencia no puntúan”.
- **Totales**: `no disponible` en ausencia, no 0; coste/tokens/caché/conteos; contraste con la
  cabecera.
- **Integración**: abrir eficiencia cierra histórico y viceversa; `Escape` no limpia la selección
  del grafo; el cambio de raíz cierra el panel.
- **Responsive**: 320 px sin scroll horizontal (revisión visual/deuda si jsdom no lo puede medir).
- **Temas**: claro/oscuro/`forced-colors` (revisión visual).
- **Cobertura**: `lib` ≥90 % líneas / 85 % ramas; hook y secciones ≥80 %.
