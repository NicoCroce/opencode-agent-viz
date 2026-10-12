import { z } from 'zod';
import type {
  ModelRef,
  SessionInboxUser,
  SessionInterruptResponse,
} from '@opencode/client';
import { TChatWriteError } from '@app/Domains/Chat/Chat.entity';
import {
  modelRefSchema,
  promptTextSchema,
  replyFormSchema,
  replyPermissionSchema,
  sessionIdSchema,
} from '@app/Domains/Chat/lib/schemas';
import { opencodeClient } from './client';

/**
 * Fachada de escritura del chat, hermana de `opencodeService` (contrato
 * `write-facade`). Mapeo 1:1 con el SDK de OpenCode; **no** se fusiona en
 * `opencodeService` para preservar el blindaje read-only de
 * `opencodeClient.spec.ts` (FR-016).
 *
 * Cada método valida su entrada con Zod **antes** de tocar la red; un fallo de
 * validación lanza `TChatWriteError('validation')` (FR-019). Los fallos de
 * transporte del SDK se envuelven como `TChatWriteError('sdk')` para que la UI
 * avise y conserve el estado para reintentar (FR-022).
 */

export interface TSendPromptInput {
  sessionID: string;
  text: string;
  /** `true` cuando la sesión está `busy`: se envía con `delivery: 'queue'`. */
  queue?: boolean;
}

export interface TReplyPermissionInput {
  sessionID: string;
  requestID: string;
  decision: 'once' | 'always' | 'reject';
  message?: string;
}

export interface TReplyFormInput {
  sessionID: string;
  formID: string;
  answer: Record<string, string | number | boolean | string[]>;
}

export interface SessionWriteService {
  sendPrompt(input: TSendPromptInput): Promise<SessionInboxUser>;
  interruptSession(sessionID: string): Promise<SessionInterruptResponse>;
  replyPermission(input: TReplyPermissionInput): Promise<void>;
  replyForm(input: TReplyFormInput): Promise<void>;
  switchAgent(sessionID: string, agent: string): Promise<void>;
  switchModel(sessionID: string, model: ModelRef): Promise<void>;
}

/** Esquema interno de `sendPrompt` (ids + texto + `queue` opcional). */
const sendPromptInputSchema = z.object({
  sessionID: sessionIdSchema,
  text: promptTextSchema,
  queue: z.boolean().optional(),
});

/** Esquema interno de `switchAgent` (ids no vacíos). */
const switchAgentInputSchema = z.object({
  sessionID: sessionIdSchema,
  agent: sessionIdSchema,
});

/** Esquema interno de `switchModel` (id + referencia de modelo válida). */
const switchModelInputSchema = z.object({
  sessionID: sessionIdSchema,
  model: modelRefSchema,
});

/** Valida con Zod; un fallo lanza `TChatWriteError('validation')` sin red. */
const validate = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new TChatWriteError(
      'validation',
      result.error.issues[0]?.message ?? 'Entrada inválida',
    );
  }
  return result.data;
};

/** Ejecuta el SDK envolviendo fallos de transporte como `TChatWriteError`. */
const callSdk = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof TChatWriteError) {
      throw error;
    }
    throw new TChatWriteError(
      'sdk',
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const sessionWriteService: SessionWriteService = {
  async sendPrompt(input) {
    const { sessionID, text, queue } = validate(sendPromptInputSchema, input);
    return callSdk(() =>
      opencodeClient.session.prompt(
        queue ? { sessionID, text, delivery: 'queue' } : { sessionID, text },
      ),
    );
  },

  async interruptSession(sessionID) {
    const id = validate(sessionIdSchema, sessionID);
    return callSdk(() => opencodeClient.session.interrupt({ sessionID: id }));
  },

  async replyPermission(input) {
    const { sessionID, requestID, decision, message } = validate(
      replyPermissionSchema,
      input,
    );
    return callSdk(() =>
      opencodeClient.permission.reply({
        sessionID,
        requestID,
        decision,
        ...(message !== undefined ? { message } : {}),
      }),
    );
  },

  async replyForm(input) {
    const { sessionID, formID, answer } = validate(replyFormSchema, input);
    return callSdk(() =>
      opencodeClient.session.form.reply({ sessionID, formID, answer }),
    );
  },

  async switchAgent(sessionID, agent) {
    const parsed = validate(switchAgentInputSchema, { sessionID, agent });
    return callSdk(() =>
      opencodeClient.session.switchAgent({
        sessionID: parsed.sessionID,
        agent: parsed.agent,
      }),
    );
  },

  async switchModel(sessionID, model) {
    const parsed = validate(switchModelInputSchema, { sessionID, model });
    return callSdk(() =>
      opencodeClient.session.switchModel({
        sessionID: parsed.sessionID,
        model: parsed.model,
      }),
    );
  },
};
