import type { CatalogReadService } from './catalog.service';
import { catalogReadService } from './catalog.service';
import type { EventReadService } from './event.service';
import { eventReadService } from './event.service';
import type { FormReadService } from './form.service';
import { formReadService } from './form.service';
import type { SessionReadService } from './session.service';
import { sessionReadService } from './session.service';

/**
 * Único punto de acceso al SDK de OpenCode (Constitución III).
 * Read-only: solo se exponen métodos de lectura (FR-016).
 *
 * Fachada que reexporta el singleton, los tipos de mensaje y compone el
 * servicio por sub-dominio. La implementación vive en `client.ts`,
 * `message.entity.ts`, `session.service.ts`, `form.service.ts`,
 * `catalog.service.ts` y `event.service.ts`.
 */
export { opencodeClient, resolveBaseUrl } from './client';
export { normalizeMessages } from './message.entity';
export type { TContentPart, TSessionMessage } from './message.entity';

export interface OpenCodeService
  extends SessionReadService,
    FormReadService,
    CatalogReadService,
    EventReadService {}

export const opencodeService: OpenCodeService = {
  ...sessionReadService,
  ...formReadService,
  ...catalogReadService,
  ...eventReadService,
};
