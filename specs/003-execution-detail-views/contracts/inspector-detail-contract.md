# Contract — Detalle del agente (`Domains/Inspector/`)

Cubre US1 (respuestas/razonamiento), US5 (archivos), US6 (permisos/preguntas/cola) y US7 (diagnóstico). Las secciones son presentación pura; la lógica vive en hooks y funciones puras.

## Hooks (`Inspector.service.ts` / `useInspectorData.ts`)

```ts
useSessionDiff(sessionId: string | null): { changes: TFileChange[]; ... estados };
useSessionForms(sessionId: string | null): { questions: TQuestionEntry[]; ... estados };
useSessionPermissions(sessionId: string | null): { permissions: TPermissionEntry[]; ... estados };
useSessionInbox(sessionId: string | null): { queuedTurns: number; items: SessionInboxInfo[]; ... estados };
useSessionContext(sessionId: string | null): { messages: SessionMessageInfo[]; ... estados };  // bajo demanda
```

- `useSessionForms` = `listSessionForms` + `getSessionForm` por formulario para resolver `state` (R8).
- Todos usan TanStack Query (Principio III) y exponen `isError`/`isLoading` para los estados de pantalla.

## Secciones (`InspectorPanel`)

### `AnswersSection` (US1, FR-001/002)

- Lista las entradas `answer` y `reasoning` del agente en orden cronológico, con `RichText`.
- Toggle de razonamiento con `Button` `aria-pressed` (coherente con el botón "Seguir"); ocultarlo no afecta a las respuestas (FR-002).
- Una respuesta sin consolidar se muestra "en curso" (FR-006).
- Sin respuestas → estado vacío explícito ("Sin respuestas todavía"), sin secciones fantasma (edge case).
- Botón "Ver histórico completo" que abre el overlay (FR-008).

### `FileChanges` (US5, FR-028..030)

- Lista `TFileChange` con `file`, estado (añadido/modificado/borrado) y `+additions`/`-deletions`.
- Seleccionar un archivo muestra su `patch` (FR-029); parche vacío/ausente → "parche no disponible" sin bloquear.
- Sin cambios → estado vacío explícito (FR-030).

### `QuestionsSection` (US6, FR-031..034)

- **Permisos**: `action` (operación) y `resources[]` (FR-031); si hay uno → el nodo está `waiting-permission`.
- **Preguntas**: `title`, `fields[].title/options` y la respuesta cuando existe; `pending`/`cancelled` nunca se muestran como `answered` (FR-032/033); un formulario `pending` → `waiting-input`.
- **Cola**: `queuedTurns` = items con `delivery === 'queue'` (FR-034).
- Sin permisos ni preguntas → estado vacío explícito.

### `ToolHistory` (US7, FR-036, ampliado)

- Conserva el truncado de 10 (feature 002) y añade una fila por herramienta con `calls` y `medianMs` (`medianToolDurations`, pura).
- Mediana sin datos → "no disponible".

## Reglas

- Ningún componente importa el SDK ni otro dominio salvo tipos (Principio III, patrón ya existente `TGraphNode`).
- Cada sección renderiza error → loading → vacío → datos (Principio VI).
- Datos ausentes → "no disponible" (FR-038).
- Solo lectura: no hay acciones de responder permiso/pregunta (FR-037).
