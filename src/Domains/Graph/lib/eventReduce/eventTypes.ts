import type {
  SessionMessageContentUpdated,
  V2Event,
} from '@opencode/client';

/**
 * `session.message.content.updated` es un evento **durable**: llega por el log
 * (`SessionEventDurable`) y no por el stream SSE (`V2Event`). El reducer acepta
 * ambos para poder aplicar tambien las instantaneas consolidadas del log.
 */
export type TReducibleEvent = V2Event | SessionMessageContentUpdated;

/** Los cuatro eventos que describen el ciclo de vida de una parte de tool. */
export type TToolEvent = Extract<
  V2Event,
  | { type: 'session.tool.input.started' }
  | { type: 'session.tool.called' }
  | { type: 'session.tool.success' }
  | { type: 'session.tool.failed' }
>;
