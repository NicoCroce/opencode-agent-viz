# Contrato — Fachada de escritura y respuestas

**Feature**: `009-interactive-chat`
**Cubre**: FR-001, FR-004, FR-005, FR-006, FR-007, FR-019, FR-020, FR-022, FR-023
**Implementa**: `Infrastructure/Services/session.write.service.ts` (**nuevo**), `Infrastructure/Services/opencodeClient.ts` (export hermano),
`Infrastructure/Services/catalog.service.ts` (`listModels`/`getDefaultModel`),
`Domains/Chat/lib/schemas.ts`, `Domains/Chat/Chat.service.ts`.

---

## 1. Superficie de la fachada (hermana de `opencodeService`)

```ts
// Infrastructure/Services/session.write.service.ts
export interface SessionWriteService {
  sendPrompt(input: { sessionID: string; text: string; queue?: boolean }): Promise<SessionInboxUser>;
  interruptSession(sessionID: string): Promise<{ interrupted: boolean }>;
  replyPermission(input: {
    sessionID: string; requestID: string;
    decision: 'once' | 'always' | 'reject'; message?: string;
  }): Promise<void>;
  replyForm(input: {
    sessionID: string; formID: string;
    answer: Record<string, string | number | boolean | string[]>;
  }): Promise<void>;
  switchAgent(sessionID: string, agent: string): Promise<void>;
  switchModel(sessionID: string, model: ModelRef): Promise<void>;
}
```

- **Mapeo 1:1** con el SDK: `session.prompt` / `session.interrupt` / `permission.reply` / `session.form.reply` / `session.switchAgent` / `session.switchModel`.
- **No** se fusiona en `opencodeService`: se exporta como singleton hermano en `opencodeClient.ts` para preservar el blindaje `opencodeClient.spec.ts` (FR-016).
- `sendPrompt` traduce `queue: true` → `text.delivery = 'queue'`; `queue` ausente → comportamiento por defecto (`steer` implícito del servidor), como se describe en §3.

## 2. Validación Zod (antes del SDK) — FR-019

| Esquema | Regla | Error |
|---------|-------|-------|
| `promptTextSchema` | `trim()` no vacío, longitud acotada | no toca la red; lanza `TChatWriteError` |
| `sessionIdSchema` / ids de request/form | no vacíos | idem |
| `permissionDecisionSchema` | `'once' \| 'always' \| 'reject'` | idem |
| `formAnswerSchema` | valores por `field.key` del pendiente | idem |
| `modelRefSchema` | `{ id, providerID, variant? }` no vacíos | idem |

- La validación corre **dentro** del service (lógica de negocio, AGENTS §4/§10), no en el componente.
- Los **ids** de permiso/form provienen del **pendiente reducido**, nunca de texto libre del usuario.

## 3. Envío y cola — FR-001 / FR-020

- Texto no vacío → `sendPrompt`. El mensaje propio se refleja en el timeline (FR-001).
- Si la sesión está `busy`, el servicio envía con `delivery: 'queue'`; el servidor aplica el prompt **al terminar el turno** sin interrumpirlo. La UI lo indica (`TChatDraft.queued`).
- Si la sesión está ociosa, se envía sin `delivery`.
- **Prohibido** deshabilitar el composer por estar `busy` (contradice FR-020).

## 4. Interrupción — FR-004

- Solo actúa sobre el `sessionID` de la sesión **abierta**; los subagentes (sesiones hijas) **no** se detienen.
- El control "Detener" solo está disponible con `status === 'busy'`; muestra `aria-busy` y estado de carga (`isPending`) mientras la mutation está en curso.
- Se pide confirmación (`AlertDialog`) antes de interrumpir.

## 5. Respuestas a pendientes — FR-005/F006/F007/F017/F022/F023

- **Permiso**: `once` / `always` / `reject`. Antes de confirmar se muestra `action` y `resources[]`; para `always` el recurso autorizado queda visible (FR-017).
- **Pregunta**: formulario mínimo por `field` (string/number/integer/boolean/multiselect/external) → `answer` por `field.key` (FR-005).
- **Origen**: el `sessionID` usado es el que generó el pendiente —hija incluida— (FR-007).
- **Revalidación (FR-006)**: antes de enviar se comprueba que el pendiente siga abierto (existe en `permissions.list()` o en `forms` con `state.status === 'pending'`). Si no, se muestra aviso y **no** se aplica.
- **Fallo de escritura (FR-022)**: aviso efímero y accesible (toast `sonner`, live region); se **conserva** el texto/estado para reintentar.
- **Sin adjuntos (FR-023)**: el composer solo acepta texto; los formularios de pendiente aceptan el tipo del campo, no adjuntos libres.

## 6. Invalidación tras responder

Tras una respuesta exitosa, la mutation invalida:
`permissions.list()`, `permissions.for(originSessionId)` y `sessions.forms(originSessionId)`.
Así el pendiente desaparece de la bandeja y se limpian las señales de atención (FR-011).

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| W1 | `opencodeService` **no** gana nombres de escritura | `opencodeClient.spec.ts` sin cambios (verde) |
| W2 | `sessionWriteService.sendPrompt` mapea a `session.prompt`; con `queue` usa `delivery: 'queue'` | `session.write.service.spec.ts` (spy) |
| W3 | Texto vacío/solo espacios no llama al SDK y lanza `TChatWriteError` | spec puro de `schemas`/service |
| W4 | `interruptSession` llama con el `sessionID` dado (abierto) y devuelve `{ interrupted }` | spec de service |
| W5 | `replyPermission` mapea decisión `once/always/reject` y valida ids | spec de service |
| W6 | `replyForm` mapea `answer` por `field.key` | spec de service |
| W7 | `switchAgent`/`switchModel` se llaman **solo** si la selección cambió, antes de `prompt` | spec de `useChatController` |
| W8 | Prevalidación: responder un pendiente ya resuelto no llama al SDK y avisa | spec de hook/componente |
| W9 | Fallo de mutation → aviso accesible y texto conservado | spec de `ChatComposer` |
| W10 | Tipo desconocido/inválido de campo no rompe el formulario | spec de `ChatPendingRequest` |
