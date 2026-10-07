import { describe, expect, it, vi } from 'vitest';
import type {
  FormDetail,
  SessionLogItem,
  SessionMessageInfo,
  SessionStatsInfo,
  SessionTransferData,
} from '@opencode/client';
import { opencodeClient, opencodeService } from '../opencodeClient';

/** Nombres que jamás deben aparecer en la superficie del servicio (FR-037). */
const FORBIDDEN = [
  // Escrituras de sesión/prompt (ya cubiertas antes).
  'prompt',
  'abort',
  'command',
  'shell',
  'revert',
  'unrevert',
  'create',
  'update',
  'delete',
  'share',
  'unshare',
  'fork',
  'init',
  'summarize',
  'respondPermission',
  // Escrituras del contrato nuevo: form.reply/cancel, inbox.cancel/update,
  // session.interrupt, session.import (FR-037, Principio I).
  'formReply',
  'replyForm',
  'formCancel',
  'cancelForm',
  'inboxCancel',
  'cancelInbox',
  'inboxUpdate',
  'updateInbox',
  'interrupt',
  'interruptSession',
  'import',
  'importSession',
  'replyPermission',
];

const assistant = (id: string): SessionMessageInfo => ({
  id,
  type: 'assistant',
  agent: 'build',
  model: { id: 'claude', providerID: 'anthropic' },
  time: { created: 1 },
  content: [{ type: 'text', text: `hola ${id}` }],
});

describe('opencodeService', () => {
  it('exposes only read-only operations (FR-016, FR-037)', () => {
    for (const method of FORBIDDEN) {
      expect(opencodeService).not.toHaveProperty(method);
    }
  });

  it('exposes the required read operations', () => {
    const readOperations = [
      'listSessions',
      'getSessionMessages',
      'getHistoryMessages',
      'getSessionDiff',
      'getSessionStats',
      'listSessionForms',
      'getSessionForm',
      'listSessionInbox',
      'getSessionContext',
      'getSessionLog',
      'exportSession',
      'subscribeEvents',
    ] as const;

    for (const method of readOperations) {
      expect(typeof opencodeService[method]).toBe('function');
    }
  });

  describe('getHistoryMessages', () => {
    it('paginages by cursor, newest first, and exposes nextCursor', async () => {
      const list = vi
        .spyOn(opencodeClient.message, 'list')
        .mockResolvedValueOnce({
          data: [assistant('m2'), assistant('m1')],
          cursor: { next: 'cur_2' },
        })
        .mockResolvedValueOnce({
          data: [assistant('m0')],
          cursor: { next: null },
        });

      const first = await opencodeService.getHistoryMessages('ses_1');
      expect(first.messages.map((message) => message.info.id)).toEqual([
        'm2',
        'm1',
      ]);
      // Reutiliza `normalizeMessages`: el `content` del assistant va a `parts`.
      expect(first.messages[0]?.parts).toEqual([
        { type: 'text', text: 'hola m2' },
      ]);
      expect(first.nextCursor).toBe('cur_2');
      expect(list).toHaveBeenNthCalledWith(1, {
        sessionID: 'ses_1',
        limit: 200,
        order: 'desc',
      });

      const second = await opencodeService.getHistoryMessages('ses_1', 'cur_2');
      expect(second.messages.map((message) => message.info.id)).toEqual(['m0']);
      expect(second.nextCursor).toBeNull();
      // El cursor ya fija la dirección: nunca se combina con `order`.
      expect(list).toHaveBeenNthCalledWith(2, {
        sessionID: 'ses_1',
        limit: 200,
        cursor: 'cur_2',
      });
    });

    it('returns null when the page has no next cursor', async () => {
      vi.spyOn(opencodeClient.message, 'list').mockResolvedValueOnce({
        data: [],
        cursor: {},
      });

      const page = await opencodeService.getHistoryMessages('ses_1');
      expect(page.messages).toEqual([]);
      expect(page.nextCursor).toBeNull();
    });

    it('propagates SDK rejections', async () => {
      const error = new Error('history boom');
      vi.spyOn(opencodeClient.message, 'list').mockRejectedValue(error);

      await expect(opencodeService.getHistoryMessages('ses_1')).rejects.toBe(
        error,
      );
    });
  });

  describe('new read wrappers', () => {
    it('getSessionDiff forwards the session id', async () => {
      const diff = vi.spyOn(opencodeClient.session, 'diff').mockResolvedValue([]);

      await opencodeService.getSessionDiff('ses_1');
      expect(diff).toHaveBeenCalledWith({ sessionID: 'ses_1' });
    });

    it('getSessionStats forwards the optional input', async () => {
      const stats = vi
        .spyOn(opencodeClient.session, 'stats')
        .mockResolvedValue({} as unknown as SessionStatsInfo);

      await opencodeService.getSessionStats({ project: 'proj_1' });
      expect(stats).toHaveBeenCalledWith({ project: 'proj_1' });
    });

    it('listSessionForms and getSessionForm forward the ids', async () => {
      const list = vi
        .spyOn(opencodeClient.session.form, 'list')
        .mockResolvedValue([]);
      const get = vi
        .spyOn(opencodeClient.session.form, 'get')
        .mockResolvedValue({} as unknown as FormDetail);

      await opencodeService.listSessionForms('ses_1');
      await opencodeService.getSessionForm('ses_1', 'form_1');
      expect(list).toHaveBeenCalledWith({ sessionID: 'ses_1' });
      expect(get).toHaveBeenCalledWith({ sessionID: 'ses_1', formID: 'form_1' });
    });

    it('listSessionInbox and getSessionContext forward the session id', async () => {
      const inbox = vi
        .spyOn(opencodeClient.session.inbox, 'list')
        .mockResolvedValue([]);
      const context = vi
        .spyOn(opencodeClient.session, 'context')
        .mockResolvedValue([]);

      await opencodeService.listSessionInbox('ses_1');
      await opencodeService.getSessionContext('ses_1');
      expect(inbox).toHaveBeenCalledWith({ sessionID: 'ses_1' });
      expect(context).toHaveBeenCalledWith({ sessionID: 'ses_1' });
    });

    it('exportSession forwards id and sanitize flag', async () => {
      const exportSession = vi
        .spyOn(opencodeClient.session, 'export')
        .mockResolvedValue({} as unknown as SessionTransferData);

      await opencodeService.exportSession('ses_1', true);
      expect(exportSession).toHaveBeenCalledWith({
        sessionID: 'ses_1',
        sanitize: true,
      });
    });

    it('getSessionLog materializes the async iterable with follow: false', async () => {
      const item = {
        id: 'evt_1',
        type: 'session.idle',
      } as unknown as SessionLogItem;
      // `for await` acepta iterables síncronos; el cast evita un async
      // generator vacío (require-await) sin dejar de ejercitar la materialización.
      const log = vi
        .spyOn(opencodeClient.session, 'log')
        .mockReturnValue([item] as unknown as AsyncIterable<SessionLogItem>);

      const items = await opencodeService.getSessionLog('ses_1');
      expect(items).toEqual([item]);
      expect(log).toHaveBeenCalledWith({ sessionID: 'ses_1', follow: false });
    });

    it('propagates SDK rejections', async () => {
      const error = new Error('diff boom');
      vi.spyOn(opencodeClient.session, 'diff').mockRejectedValue(error);

      await expect(opencodeService.getSessionDiff('ses_1')).rejects.toBe(error);
    });
  });
});
