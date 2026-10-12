import { describe, expect, it } from 'vitest';
import {
  PROMPT_TEXT_MAX_LENGTH,
  formAnswerSchema,
  modelRefSchema,
  permissionDecisionSchema,
  promptTextSchema,
  replyFormSchema,
  replyPermissionSchema,
  sessionIdSchema,
} from '../schemas';

/**
 * Esquemas Zod de la fachada de escritura (FR-019; W3). Se testean puros: la
 * validación corre antes de tocar el SDK y rechaza entradas inválidas.
 */
describe('schemas', () => {
  describe('sessionIdSchema', () => {
    it('accepts non-empty ids and trims surrounding whitespace', () => {
      const parsed = sessionIdSchema.safeParse('  ses_1  ');
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data).toBe('ses_1');
    });

    it('rejects empty and whitespace-only ids', () => {
      expect(sessionIdSchema.safeParse('').success).toBe(false);
      expect(sessionIdSchema.safeParse('   ').success).toBe(false);
    });
  });

  describe('promptTextSchema', () => {
    it('accepts text with content and trims it', () => {
      const parsed = promptTextSchema.safeParse('  hola mundo  ');
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data).toBe('hola mundo');
    });

    it('rejects empty and whitespace-only text', () => {
      expect(promptTextSchema.safeParse('').success).toBe(false);
      expect(promptTextSchema.safeParse('   \n\t ').success).toBe(false);
    });

    it('rejects text above the cap', () => {
      const tooLong = 'a'.repeat(PROMPT_TEXT_MAX_LENGTH + 1);
      expect(promptTextSchema.safeParse(tooLong).success).toBe(false);
    });

    it('accepts text exactly at the cap', () => {
      const atCap = 'a'.repeat(PROMPT_TEXT_MAX_LENGTH);
      expect(promptTextSchema.safeParse(atCap).success).toBe(true);
    });
  });

  describe('permissionDecisionSchema', () => {
    it('accepts the three explicit decisions', () => {
      for (const decision of ['once', 'always', 'reject'] as const) {
        expect(permissionDecisionSchema.safeParse(decision).success).toBe(true);
      }
    });

    it('rejects any other decision', () => {
      expect(permissionDecisionSchema.safeParse('maybe').success).toBe(false);
      expect(permissionDecisionSchema.safeParse('').success).toBe(false);
    });
  });

  describe('replyPermissionSchema', () => {
    it('accepts a valid permission reply with optional message', () => {
      const parsed = replyPermissionSchema.safeParse({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'always',
        message: 'ok',
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts a valid permission reply without message', () => {
      const parsed = replyPermissionSchema.safeParse({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'reject',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects empty ids', () => {
      expect(
        replyPermissionSchema.safeParse({
          sessionID: '',
          requestID: 'req_1',
          decision: 'once',
        }).success,
      ).toBe(false);
      expect(
        replyPermissionSchema.safeParse({
          sessionID: 'ses_1',
          requestID: '  ',
          decision: 'once',
        }).success,
      ).toBe(false);
    });

    it('rejects an unknown decision', () => {
      expect(
        replyPermissionSchema.safeParse({
          sessionID: 'ses_1',
          requestID: 'req_1',
          decision: 'nope',
        }).success,
      ).toBe(false);
    });
  });

  describe('formAnswerSchema', () => {
    it('accepts values keyed by field key', () => {
      const parsed = formAnswerSchema.safeParse({
        name: 'Ada',
        age: 36,
        ok: true,
        tags: ['a', 'b'],
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts an empty answer object', () => {
      expect(formAnswerSchema.safeParse({}).success).toBe(true);
    });

    it('rejects unsupported value shapes', () => {
      expect(formAnswerSchema.safeParse({ nested: { a: 1 } }).success).toBe(
        false,
      );
      expect(formAnswerSchema.safeParse({ mixed: [1, 2] }).success).toBe(false);
    });
  });

  describe('replyFormSchema', () => {
    it('accepts a valid form reply', () => {
      const parsed = replyFormSchema.safeParse({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer: { name: 'Ada' },
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects empty ids', () => {
      expect(
        replyFormSchema.safeParse({
          sessionID: 'ses_1',
          formID: '',
          answer: {},
        }).success,
      ).toBe(false);
    });

    it('rejects an invalid answer payload', () => {
      expect(
        replyFormSchema.safeParse({
          sessionID: 'ses_1',
          formID: 'form_1',
          answer: { nested: { a: 1 } },
        }).success,
      ).toBe(false);
    });
  });

  describe('modelRefSchema', () => {
    it('accepts a model ref with an optional variant', () => {
      expect(
        modelRefSchema.safeParse({
          id: 'claude',
          providerID: 'anthropic',
          variant: 'high',
        }).success,
      ).toBe(true);
      expect(
        modelRefSchema.safeParse({ id: 'claude', providerID: 'anthropic' })
          .success,
      ).toBe(true);
    });

    it('rejects empty id or providerID', () => {
      expect(
        modelRefSchema.safeParse({ id: '', providerID: 'anthropic' }).success,
      ).toBe(false);
      expect(
        modelRefSchema.safeParse({ id: 'claude', providerID: '  ' }).success,
      ).toBe(false);
    });
  });
});
