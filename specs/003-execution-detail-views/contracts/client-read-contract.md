# Contract — Lectura del SDK (`Infrastructure/Services/opencodeClient.ts`)

Cubre la ampliación del wrapper de solo lectura (Principio III, FR-037). Todos los métodos son `async` y devuelven tipos del SDK o proyecciones normalizadas ya existentes (`TSessionMessage`).

## Métodos nuevos

```ts
interface OpenCodeService {
  // Histórico: paginación por cursor, sin tope fijo (FR-013).
  // 1ª página: order: 'desc' (más reciente primero); el cursor fija la dirección.
  getHistoryMessages(
    id: string,
    cursor?: string,
  ): Promise<{ messages: TSessionMessage[]; nextCursor: string | null }>;

  // Impacto en el repositorio (US5).
  getSessionDiff(id: string): Promise<FileDiffInfo[]>;

  // Agregado por proyecto/rango (wrapper expuesto, NO cableado — R2/R10).
  getSessionStats(input?: SessionStatsInput): Promise<SessionStatsInfo>;

  // Preguntas al usuario (US6).
  listSessionForms(id: string): Promise<FormInfo[]>;
  getSessionForm(id: string, formID: string): Promise<FormDetail>;

  // Cola de turnos (FR-034) e items de inbox.
  listSessionInbox(id: string): Promise<SessionInboxInfo[]>;

  // Contexto resultante de compactación (US7).
  getSessionContext(id: string): Promise<SessionMessageInfo[]>;

  // Log durable: siembra de señales de ejecución (US3). `follow: false`.
  getSessionLog(id: string): Promise<SessionLogItem[]>;

  // Export completo (wrapper expuesto, NO cableado — R2/R3).
  exportSession(id: string, sanitize?: boolean): Promise<SessionTransferData>;
}
```

`getSessionMessages(id)` (existente, `order: 'asc'`, acotado) se conserva para el grafo y el inspector: el resumen del grafo mantiene su carga acotada.

## Reglas

- **Solo lectura**: ningún método nuevo muta estado del servidor. No se exponen `form.reply`/`cancel`, `inbox.cancel`/`update`, `interrupt`, `import` (FR-037, Principio I).
- **Paginación**: `message.list` limita `limit` a 200; el cursor ya fija la dirección, por lo que no se combina `cursor` + `order`. `nextCursor = cursor.next ?? null`.
- **Normalización**: `getHistoryMessages` reutiliza `normalizeMessages()` (mismo `TSessionMessage = { info, parts }` que el resto de la app).
- **Sin lógica de negocio**: el wrapper no filtra, agrega ni transforma; eso vive en `lib/` (Principio V).
- **Errores**: se propagan como rechazos de promesa; los hooks los traducen a los estados de pantalla (Principio VI).
- `getSessionLog` consume el `AsyncIterable` con `follow: false` y lo materializa en un array; el hook acota la lectura a lo necesario para las señales.

## Consumidores

| Método | Hook | Vista |
|--------|------|-------|
| `getHistoryMessages` | `useHistoryPagination` | `HistoryTimeline` |
| `getSessionDiff` | `useSessionDiff` | `FileChanges` |
| `listSessionForms` + `getSessionForm` | `useSessionForms` | `QuestionsSection` |
| `listSessionInbox` | `useSessionInbox` | `QuestionsSection` (cola) |
| `getSessionContext` | `useSessionContext` | detalle de compactación |
| `getSessionLog` | `useExecutionSignals` | estado enriquecido |
| `getSessionStats`, `exportSession` | — | no cableados (documentado en R2) |
