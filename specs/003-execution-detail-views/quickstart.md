# Quickstart & Validation — Detalle de ejecución de agentes

Guía para validar la feature de punta a punta. Los detalles de contrato están en [contracts/](./contracts/) y el modelo de datos en [data-model.md](./data-model.md).

## Prerrequisitos

- Node instalado; dependencias: `pnpm install` (incluye las nuevas `react-markdown`, `remark-gfm`, `rehype-sanitize`).
- Un servidor local de OpenCode disponible (el proxy Vite `/oc` apunta al background service vía `OPENCODE_URL`).
- Una sesión raíz con al menos un subagente que haya producido texto y razonamiento, con herramientas, archivos modificados, un permiso o pregunta y, si es posible, un reintento y una compactación.
- Fixture de eventos real ya versionado: `src/Domains/Graph/lib/__fixtures__/run.ndjson`.

## Comandos

```bash
pnpm install
pnpm dev          # levanta Vite con proxy /oc
pnpm tsc          # typecheck estricto
pnpm lint         # ESLint strict
pnpm test         # Vitest (unit + componentes + hooks)
```

## Vistas y endpoints de lectura

La feature añade vistas de solo lectura sobre el SDK; ningún endpoint escribe (FR-037). El acceso al SDK vive únicamente en `src/Infrastructure/Services/opencodeClient.ts`:

| Vista | Endpoint de lectura | Hook |
|-------|---------------------|------|
| Respuestas y razonamiento | mensajes ya cacheados del grafo (`session.message.list`) | `useInspectorData` |
| Histórico completo | `session.message.list` (paginado por cursor, `order: 'desc'`) | `useHistoryMessages` / `useHistoryPagination` |
| Estado de ejecución | `session.log` (`follow: false`) + caché en vivo de eventos | `useExecutionSignals` |
| Resumen de sesión | métricas ya cargadas (`summarizeSession`) | `useGraphModel` / `useNow` |
| Impacto en el repositorio | `session.diff` | `useSessionDiff` |
| Espera: preguntas/permisos/cola | `session.form.list` + `session.form.get`, `permission.list`, `session.inbox.list` | `useSessionForms` / `useSessionPermissions` / `useSessionInbox` |
| Contexto de compactación | `session.context` | `useSessionContext` |

Dependencias nuevas de renderizado: `react-markdown` (markdown), `remark-gfm` (tablas/GFM) y `rehype-sanitize` (neutraliza HTML/`<script>`/`javascript:`; sin `dangerouslySetInnerHTML`).

## Escenarios de validación

### V1 — Respuestas y razonamiento (US1, FR-001..FR-007, SC-001/002)

1. Abre el detalle de un agente que produjo texto → se leen sus respuestas **en orden**, junto a las llamadas a herramienta intercaladas.
2. Activa el razonamiento → se hace visible sin ocultar las respuestas; desactívalo → se oculta y las respuestas permanecen.
3. Expande una herramienta terminada → se ven entrada y resultado completos; en una fallida, el error.
4. Una respuesta en curso se indica "en curso"; **nunca** aparece texto parcial como completo.
5. Un mensaje del usuario se distingue de las respuestas del agente.
6. Un texto con `<script>`, tablas, listas y bloques de código se renderiza con formato y **no ejecuta** el script.
**Esperado**: la primera respuesta se lee en < 3 clics; 100% de respuestas en orden (SC-001/002).

### V2 — Histórico completo (US2, FR-008..FR-016, SC-003/004/011)

1. Doble clic sobre un nodo del grafo → se abre el overlay con toda la actividad de esa sesión en orden cronológico.
2. El botón "Ver histórico completo" del detalle abre el mismo overlay.
3. La cabecera muestra identidad, modelo, estado, coste, tokens, resultado final y directorio (o "no disponible").
4. Usa "Invocado por" / "Invocó a" → se abre el histórico del padre/hijo **sin cerrar** el overlay.
5. Con una sesión larga, desplázate → la actividad se amplía sin tope y la interfaz responde fluida (sin bloqueos).
6. Cierra el overlay → vuelves al grafo con la misma selección y disposición.
7. Abre un agente sin actividad → estado vacío explícito (no una vista en blanco).
8. Simula un fallo de página (o servidor que corta) → aviso explícito de que puede faltar actividad.
**Esperado**: histórico de cualquier agente en un solo gesto (SC-003); salto al invocador en un gesto (SC-004); miles de entradas fluidas (SC-011).

### V3 — Estado de ejecución enriquecido (US3, FR-017..FR-023, SC-005/006/007)

1. Reproduce (o carga con el fixture) un reintento → el nodo muestra "Reintentando" con el número de intento y, si el servidor lo reporta, el próximo intento.
2. Un agente que falló en una herramienta pero sigue ejecutando → el nodo se muestra en ejecución, **no** fallido.
3. Un agente terminado con éxito se distingue de uno que nunca ejecutó (`created`).
4. Una interrupción se distingue de un fallo propio e indica el motivo (o "no disponible").
5. Un agente esperando un permiso vs. una respuesta del usuario se distinguen (no ambos de forma ambigua).
6. El estado coincide entre el nodo y el detalle.
**Esperado**: estado real en < 5 s por nodo (SC-005); 0 casos de error superado marcando fallida una ejecución activa (SC-006); interrupción vs. fallo distinguidos al 100% (SC-007).

### V4 — Resumen de sesión (US4, FR-024..FR-027, SC-008)

1. Abre una sesión con agentes en distintos estados → la barra muestra cantidad en curso, esperando, con error y total.
2. Muestra coste y tokens acumulados de todos los agentes.
3. Muestra el tiempo transcurrido.
4. Llega actividad nueva → el resumen se actualiza sin reordenar ni saltar la vista.
**Esperado**: contadores, coste y tokens sin inspeccionar nodo por nodo (SC-008).

### V5 — Impacto en el repositorio (US5, FR-028..FR-030, SC-009)

1. Inspecciona un agente que modificó archivos → lista con estado y líneas añadidas/quitadas.
2. Selecciona un archivo → su parche completo (o "parche no disponible").
3. Un agente sin cambios → "Sin cambios de archivos" explícito.
**Esperado**: archivos afectados en un gesto desde el detalle (SC-009).

### V6 — Por qué espera y diagnóstico (US6/US7, FR-031..FR-036, SC-010)

1. Un agente esperando permiso → operación y recursos afectados.
2. Un agente que preguntó al usuario → texto de la pregunta y opciones; si está respondida, la respuesta en su posición cronológica.
3. Una pregunta cancelada o pendiente se distingue de una respondida.
4. Turnos en cola → contador.
5. Un agente que compactó → episodio marcado en el histórico con su estado (en curso/completada/fallida).
6. Herramientas con duración → mediana por herramienta además de las ejecuciones.
**Esperado**: explicar por qué está detenida sin salir del visor (SC-010).

### V7 — Regresiones, responsive y solo lectura (FR-037..FR-041, SC-012)

1. Provoca error/loading/vacío de conexión o datos → cada vista afectada conserva sus estados obligatorios.
2. En viewport móvil, el histórico se ofrece a pantalla completa y el resto de capacidades siguen utilizables, sin duplicar lógica.
3. Verifica que ninguna capacidad envía prompts, aborta sesiones ni responde permisos/preguntas (solo lectura).
4. Verifica que **no** se procesan deltas de texto: el texto aparece consolidado, nunca palabra a palabra.
**Esperado**: sin regresiones en los estados de conexión/carga/vacío/error (SC-012).

## Tests automáticos esperados

- `buildHistory.spec.ts` — orden cronológico, intercalado de tools, en curso, adjuntos, compaction, idle.
- `nodeStatus.spec.ts` — 9 estados, prioridad y FR-020 (error superado no tiñe activo/exitoso).
- `deriveMetrics.spec.ts` — conteos nuevos, `elapsedMs`, sumas de coste/tokens.
- `eventReducer.spec.ts` — text/reasoning `ended`, `content.updated`, retry, compaction, outcome, inbox, forms; **ignora** deltas.
- `medianToolDurations.spec.ts` — 0/1/varias herramientas, mediana par/impar, tiempos faltantes.
- `RichText.spec.tsx` — listas, código, tabla, énfasis y neutralización de HTML/`javascript:`.
- `HistoryModal`/`HistoryTimeline`/`ToolCallEntry.spec.tsx` — expandir tool, vacío, en curso, aviso FR-016.
- `AnswersSection.spec.tsx`, `FileChanges.spec.tsx`, `QuestionsSection.spec.tsx`, `SessionSummaryBar.spec.tsx`, `AgentNode.spec.tsx`, `ToolHistory.spec.tsx`.
- `useExecutionSignals.spec.tsx`, `useHistoryPagination.spec.tsx`, `useHistory.spec.tsx`, `useReasoningVisibility.spec.tsx`, `useInspectorData.spec.tsx`.
- `live.integration.spec.ts` — estado enriquecido y timeline derivados de `run.ndjson`.

## Criterio de "listo"

Todos los escenarios V1–V7 se cumplen; `pnpm tsc`, `pnpm lint` y `pnpm test` pasan; y las SC-001..SC-012 de [spec.md](./spec.md) son verificables.
