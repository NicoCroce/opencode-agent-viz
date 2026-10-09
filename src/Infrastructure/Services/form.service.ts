import type { FormDetail, FormInfo, SessionInboxInfo } from '@opencode/client';
import { opencodeClient } from './client';

/** Preguntas al usuario y cola de inbox de una sesión (FR-032, FR-034). */
export interface FormReadService {
  listSessionForms: (id: string) => Promise<FormInfo[]>;
  getSessionForm: (id: string, formID: string) => Promise<FormDetail>;
  listSessionInbox: (id: string) => Promise<SessionInboxInfo[]>;
}

export const formReadService: FormReadService = {
  async listSessionForms(id) {
    return opencodeClient.session.form.list({ sessionID: id });
  },
  async getSessionForm(id, formID) {
    return opencodeClient.session.form.get({ sessionID: id, formID });
  },
  async listSessionInbox(id) {
    return opencodeClient.session.inbox.list({ sessionID: id });
  },
};
