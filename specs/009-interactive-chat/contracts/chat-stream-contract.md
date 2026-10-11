# Contrato — Streaming del chat

**Feature**: `009-interactive-chat`
**Cubre**: FR-002, FR-003, FR-016 · SC-003, SC-004
**Implementa**: `Domains/Graph/lib/eventReduce/slices/chatStream.ts` (**nuevo**), `slices/ignored.ts` (ajuste),
`eventReducer.ts` (ajuste aditivo), `Domains/queryKeys.ts` (`chatStream`),
`Domains/Chat/lib/mergeChatStream.ts`, `Domains/Chat/lib/buildChatTimeline.ts`,
`Domains/Chat/Components/ChatTimeline.tsx`.

---

## 1. Clave y estado del buffer

```ts
queryKeys.chatStream.for(id) // ['chatStream', id]  ← clave RAÍZ, fuera de ['sessions']
```

```ts
// Domains/Chat/Chat.entity.ts
interface TChatStreamPart { kind: 'text' | 'reasoning'; text: string; at: number }
interface TChatStreamBuffer {
  assistantMessageID: string;
  parts: Record<number, TChatStreamPart>; // por `ordinal`
}
```

- Del estado global pasan a **no** ignorarse `session.text.delta` y `session.reasoning.delta`; se eliminan de `IGNORED_EVENT_TYPES` (se conservan `session.tool.input.delta`, `session.tool.progress`, `session.compaction.delta`).
- `eventReducer.ts` enruta los dos deltas a `reduceChatStream` (cambio **aditivo**; los demás slices intactos).

## 2. Reducción de un delta (`mergeChatStream`, puro)

- Si `event.data.assistantMessageID !== buffer.assistantMessageID` → **reset**: nuevo buffer con una sola parte.
- Si es el mismo mensaje → upsert del `ordinal`: `parts[ordinal].text += event.data.delta`.
- La clave del buffer es `['chatStream', event.data.sessionID]` → **un** `setQueryData` por flush (~10/s), no por delta.
- El grafo **no** se suscribe a `['chatStream', …]` (SC-003).

## 3. Proyección del timeline (`buildChatTimeline`, puro)

Entrada: historial consolidado (`buildHistory(TSessionMessage[])`) + buffer + preguntas.
Reglas:

1. Se construye el timeline consolidado (respuestas finales, razonamiento, tools, preguntas).
2. **Dedupe**: toda parte del buffer cuya clave `assistantMessageID:ordinal` **ya exista consolidada** se **descarta** (evita duplicar tras `session.text.ended`/`reasoning.ended`, FR-003).
3. Las partes del buffer sin consolidar se agregan al final como entradas **provisionales** con `isComplete: false`.
4. Orden por `at` ascendente; el provisional de un mensaje en curso queda después de lo consolidado.

## 4. Presentación (FR-002/FR-006, SC-004)

| Estado | Render | Motivo |
|--------|--------|--------|
| Provisional (delta) | **texto plano** + etiqueta "En curso" (`isComplete: false`) | evita re-parse de `react-markdown` sobre texto creciente ~10/s |
| Consolidado (`*.ended`) | `THistoryEntry` con `RichText` (markdown saneado) | formato final una sola vez |
| Razonamiento provisional | texto plano atenuado (respeta `useReasoningVisibility`) | idem |

- `memo` en `ChatTimeline`, `HistoryEntry` y `HistoryEntryBody`; el timeline no re-renderiza por cambios ajenos a su `text`.
- **Nunca** se presenta el texto provisional como respuesta consolidada (FR-002/FR-003).

## 5. No-relayout del grafo (FR-016, SC-003)

- El buffer vive en una clave raíz distinta de `['sessions']`; ni el modelo del grafo ni `layoutGraph`/`deriveExecutionKey` leen esa clave.
- **0 reposicionamientos** del grafo durante un turno (SC-003).

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| S1 | Dos deltas del mismo `assistantMessageID:ordinal` concatenan el texto | spec puro `mergeChatStream.spec.ts` |
| S2 | Cambiar de `assistantMessageID` resetea el buffer (memoria acotada) | spec puro |
| S3 | Un delta no consolidado aparece como provisional "En curso" | spec `buildChatTimeline.spec.ts` |
| S4 | Al llegar `*.ended`, la parte provisional **no** se duplica | spec puro (dedupe) |
| S5 | El buffer escribe en `['chatStream', id]`, no en `['sessions']` | spec de reducer |
| S6 | `session.text.delta`/`reasoning.delta` ya no devuelven `null` (dejaron de ignorarse) | `eventReducer.spec.ts` extendido |
| S7 | El grafo no cambia de posición ante deltas de texto | spec de integración del grafo/perf |
| S8 | Texto largo no bloquea el render (texto plano durante el delta) | validación manual + perfil (SC-004) |
