import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ModelRef,
  SessionInboxUser,
  SessionInterruptResponse,
} from '@opencode/client';
import { TChatWriteError } from '@app/Domains/Chat/Chat.entity';
import { opencodeClient } from '../client';
import { sessionWriteService } from '../session.write.service';

/**
 * Fachada de escritura hermana (FR-019/F022; contrato `write-facade`).
 * Se mockea la frontera del cliente (`opencodeClient.*`) y se assertan los
 * argumentos exactos que llegan al SDK; la validación Zod corre antes y no
 * toca la red. Canon: `opencodeClient.spec.ts`.
 */
describe('sessionWriteService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendPrompt', () => {
    it('maps to session.prompt without delivery when not queued', async () => {
      const prompt = vi
        .spyOn(opencodeClient.session, 'prompt')
        .mockResolvedValue({} as SessionInboxUser);

      await sessionWriteService.sendPrompt({ sessionID: 'ses_1', text: 'hola' });

      expect(prompt).toHaveBeenCalledWith({ sessionID: 'ses_1', text: 'hola' });
    });

    it('maps queue: true to delivery: "queue"', async () => {
      const prompt = vi
        .spyOn(opencodeClient.session, 'prompt')
        .mockResolvedValue({} as SessionInboxUser);

      await sessionWriteService.sendPrompt({
        sessionID: 'ses_1',
        text: 'hola',
        queue: true,
      });

      expect(prompt).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        text: 'hola',
        delivery: 'queue',
      });
    });

    it('trims the text before calling the SDK', async () => {
      const prompt = vi
        .spyOn(opencodeClient.session, 'prompt')
        .mockResolvedValue({} as SessionInboxUser);

      await sessionWriteService.sendPrompt({
        sessionID: ' ses_1 ',
        text: '  hola  ',
      });

      expect(prompt).toHaveBeenCalledWith({ sessionID: 'ses_1', text: 'hola' });
    });

    it('rejects empty text without calling the SDK', async () => {
      const prompt = vi.spyOn(opencodeClient.session, 'prompt');

      await expect(
        sessionWriteService.sendPrompt({ sessionID: 'ses_1', text: '   ' }),
      ).rejects.toBeInstanceOf(TChatWriteError);
      await expect(
        sessionWriteService.sendPrompt({ sessionID: 'ses_1', text: '   ' }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(prompt).not.toHaveBeenCalled();
    });

    it('rejects an empty session id without calling the SDK', async () => {
      const prompt = vi.spyOn(opencodeClient.session, 'prompt');

      await expect(
        sessionWriteService.sendPrompt({ sessionID: '', text: 'hola' }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(prompt).not.toHaveBeenCalled();
    });

    it('wraps SDK failures as TChatWriteError("sdk")', async () => {
      vi.spyOn(opencodeClient.session, 'prompt').mockRejectedValue(
        new Error('prompt boom'),
      );

      const failure = sessionWriteService.sendPrompt({
        sessionID: 'ses_1',
        text: 'hola',
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({
        code: 'sdk',
        message: 'prompt boom',
      });
    });
  });

  describe('interruptSession', () => {
    it('calls session.interrupt with the given session id', async () => {
      const response: SessionInterruptResponse = { interrupted: true };
      const interrupt = vi
        .spyOn(opencodeClient.session, 'interrupt')
        .mockResolvedValue(response);

      await expect(
        sessionWriteService.interruptSession('ses_1'),
      ).resolves.toBe(response);
      expect(interrupt).toHaveBeenCalledWith({ sessionID: 'ses_1' });
    });

    it('rejects an empty session id with TChatWriteError("validation") without calling the SDK', async () => {
      const interrupt = vi.spyOn(opencodeClient.session, 'interrupt');

      const failure = sessionWriteService.interruptSession('  ');
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({ code: 'validation' });
      expect(interrupt).not.toHaveBeenCalled();
    });

    it('wraps SDK failures as TChatWriteError("sdk")', async () => {
      vi.spyOn(opencodeClient.session, 'interrupt').mockRejectedValue(
        new Error('interrupt boom'),
      );

      const failure = sessionWriteService.interruptSession('ses_1');
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({
        code: 'sdk',
        message: 'interrupt boom',
      });
    });
  });

  describe('replyPermission', () => {
    it('maps decision once/always/reject with the ids', async () => {
      const reply = vi
        .spyOn(opencodeClient.permission, 'reply')
        .mockResolvedValue(undefined);

      await sessionWriteService.replyPermission({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'always',
      });
      expect(reply).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'always',
      });

      await sessionWriteService.replyPermission({
        sessionID: 'ses_1',
        requestID: 'req_2',
        decision: 'reject',
        message: 'no',
      });
      expect(reply).toHaveBeenLastCalledWith({
        sessionID: 'ses_1',
        requestID: 'req_2',
        decision: 'reject',
        message: 'no',
      });
    });

    it('rejects an invalid decision without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.permission, 'reply');

      await expect(
        sessionWriteService.replyPermission({
          sessionID: 'ses_1',
          requestID: 'req_1',
          // @ts-expect-error decision fuera del literal permitido
          decision: 'maybe',
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('rejects an empty request id without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.permission, 'reply');

      await expect(
        sessionWriteService.replyPermission({
          sessionID: 'ses_1',
          requestID: '',
          decision: 'once',
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('maps decision "once" with the ids', async () => {
      const reply = vi
        .spyOn(opencodeClient.permission, 'reply')
        .mockResolvedValue(undefined);

      await sessionWriteService.replyPermission({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'once',
      });

      expect(reply).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'once',
      });
    });

    it('rejects an empty session id with TChatWriteError("validation") without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.permission, 'reply');

      const failure = sessionWriteService.replyPermission({
        sessionID: '  ',
        requestID: 'req_1',
        decision: 'once',
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('wraps SDK failures as TChatWriteError("sdk")', async () => {
      vi.spyOn(opencodeClient.permission, 'reply').mockRejectedValue(
        new Error('reply boom'),
      );

      const failure = sessionWriteService.replyPermission({
        sessionID: 'ses_1',
        requestID: 'req_1',
        decision: 'reject',
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({
        code: 'sdk',
        message: 'reply boom',
      });
    });
  });

  describe('replyForm', () => {
    it('maps the answer by field key', async () => {
      const reply = vi
        .spyOn(opencodeClient.session.form, 'reply')
        .mockResolvedValue(undefined);

      const answer = { name: 'Ada', age: 36, ok: true, tags: ['a', 'b'] };
      await sessionWriteService.replyForm({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer,
      });

      expect(reply).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer,
      });
    });

    it('rejects an empty form id without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.session.form, 'reply');

      await expect(
        sessionWriteService.replyForm({
          sessionID: 'ses_1',
          formID: '',
          answer: {},
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('accepts every allowed answer value type per field', async () => {
      const reply = vi
        .spyOn(opencodeClient.session.form, 'reply')
        .mockResolvedValue(undefined);

      const answer = {
        text: 'hola',
        count: 3,
        flag: false,
        tags: ['a', 'b'],
      };
      await sessionWriteService.replyForm({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer,
      });

      expect(reply).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer,
      });
    });

    it('rejects an answer value outside the allowed field types with TChatWriteError("validation") without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.session.form, 'reply');

      const failure = sessionWriteService.replyForm({
        sessionID: 'ses_1',
        formID: 'form_1',
        // @ts-expect-error valor no admitido por `formAnswerValueSchema`
        answer: { nested: { a: 1 } },
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('rejects an empty session id with TChatWriteError("validation") without calling the SDK', async () => {
      const reply = vi.spyOn(opencodeClient.session.form, 'reply');

      const failure = sessionWriteService.replyForm({
        sessionID: '  ',
        formID: 'form_1',
        answer: {},
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({ code: 'validation' });
      expect(reply).not.toHaveBeenCalled();
    });

    it('wraps SDK failures as TChatWriteError("sdk")', async () => {
      vi.spyOn(opencodeClient.session.form, 'reply').mockRejectedValue(
        new Error('form boom'),
      );

      const failure = sessionWriteService.replyForm({
        sessionID: 'ses_1',
        formID: 'form_1',
        answer: { ok: true },
      });
      await expect(failure).rejects.toBeInstanceOf(TChatWriteError);
      await expect(failure).rejects.toMatchObject({
        code: 'sdk',
        message: 'form boom',
      });
    });
  });

  describe('switchAgent', () => {
    it('calls session.switchAgent with session id and agent', async () => {
      const switchAgent = vi
        .spyOn(opencodeClient.session, 'switchAgent')
        .mockResolvedValue(undefined);

      await sessionWriteService.switchAgent('ses_1', 'build');
      expect(switchAgent).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        agent: 'build',
      });
    });

    it('rejects an empty agent without calling the SDK', async () => {
      const switchAgent = vi.spyOn(opencodeClient.session, 'switchAgent');

      await expect(
        sessionWriteService.switchAgent('ses_1', '  '),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(switchAgent).not.toHaveBeenCalled();
    });
  });

  describe('switchModel', () => {
    it('calls session.switchModel with the model ref', async () => {
      const switchModel = vi
        .spyOn(opencodeClient.session, 'switchModel')
        .mockResolvedValue(undefined);

      const model: ModelRef = {
        id: 'claude',
        providerID: 'anthropic',
        variant: 'high',
      };
      await sessionWriteService.switchModel('ses_1', model);
      expect(switchModel).toHaveBeenCalledWith({ sessionID: 'ses_1', model });
    });

    it('rejects an empty model id without calling the SDK', async () => {
      const switchModel = vi.spyOn(opencodeClient.session, 'switchModel');

      await expect(
        sessionWriteService.switchModel('ses_1', {
          id: '',
          providerID: 'anthropic',
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(switchModel).not.toHaveBeenCalled();
    });
  });
});
