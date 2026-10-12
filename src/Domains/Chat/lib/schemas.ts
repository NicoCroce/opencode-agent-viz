import { z } from 'zod';

/**
 * Esquemas Zod de la fachada de escritura del chat (FR-019; data-model §2.7).
 *
 * Se ejecutan **dentro** de `sessionWriteService` **antes** de tocar el SDK: un
 * fallo lanza `TChatWriteError` (`code: 'validation'`) sin llamar a la red. Los
 * ids de permiso/form provienen del pendiente reducido, nunca de texto libre del
 * usuario (contrato `write-facade` §2).
 */

/** Tope de longitud del prompt: acota la entrada antes de enviarla al SDK. */
export const PROMPT_TEXT_MAX_LENGTH = 32_000;

/** Identificador no vacío (sesión, request o form). Se recorta al validar. */
export const sessionIdSchema = z.string().trim().min(1, 'Identificador requerido');

/** Texto de prompt: no vacío (tras `trim`) y con tope de longitud. */
export const promptTextSchema = z
  .string()
  .trim()
  .min(1, 'El prompt no puede estar vacío')
  .max(
    PROMPT_TEXT_MAX_LENGTH,
    `El prompt no puede superar ${PROMPT_TEXT_MAX_LENGTH} caracteres`,
  );

/** Decisión explícita de permiso (FR-005). */
export const permissionDecisionSchema = z.enum(['once', 'always', 'reject']);

/** Respuesta a un permiso: ids no vacíos + decisión válida + mensaje opcional. */
export const replyPermissionSchema = z.object({
  sessionID: sessionIdSchema,
  requestID: sessionIdSchema,
  decision: permissionDecisionSchema,
  message: z.string().optional(),
});

/** Valor de un campo de pregunta: el tipo admitido por `field` (FR-005/FR-023). */
export const formAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

/** Respuesta de una pregunta: valores por `field.key`. */
export const formAnswerSchema = z.record(z.string().min(1), formAnswerValueSchema);

/** Respuesta a una pregunta: ids no vacíos + `answer` válido. */
export const replyFormSchema = z.object({
  sessionID: sessionIdSchema,
  formID: sessionIdSchema,
  answer: formAnswerSchema,
});

/** Referencia de modelo `{ id, providerID, variant? }` con ids no vacíos. */
export const modelRefSchema = z.object({
  id: sessionIdSchema,
  providerID: sessionIdSchema,
  variant: z.string().optional(),
});
