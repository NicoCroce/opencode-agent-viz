import type { TContentPart } from '@app/Infrastructure/Services/opencodeClient';
import { asRecord } from './cache';
import type { TSessionMessageCache } from './cache';
import type { TToolEvent } from './eventTypes';
import { patchMessage, withParts } from './messageParts';

export type TToolPart = Extract<TContentPart, { type: 'tool' }>;

type TToolState = TToolPart['state'];
type TToolResultContent = Extract<
  TToolState,
  { status: 'completed' }
>['content'];
type TToolInput = Extract<TToolState, { status: 'running' }>['input'];

export const inheritedInput = (existing: TToolPart | undefined): TToolInput => {
  if (!existing) return {};
  const state = existing.state;
  return state.status === 'streaming' ? {} : state.input;
};

export const toolPartFrom = (
  event: TToolEvent,
  created: number,
  existing?: TToolPart,
): TToolPart => {
  if (event.type === 'session.tool.input.started') {
    return {
      type: 'tool',
      id: event.data.id,
      name: event.data.name,
      state: { status: 'streaming', input: '' },
      time: { created },
    };
  }

  const name = existing?.name ?? event.data.id;

  if (event.type === 'session.tool.called') {
    return {
      type: 'tool',
      id: event.data.id,
      name,
      executed: event.data.executed,
      state: {
        status: 'running',
        input: asRecord(event.data.input),
        metadata: asRecord(event.data.state),
      },
      time: { created, ran: created },
    };
  }

  // `success` y `failed` no repiten `name` ni `input`: se heredan del parte ya
  // cacheado (`inheritedInput`) para no perderlos al reemplazar el estado.
  const input = inheritedInput(existing);

  if (event.type === 'session.tool.success') {
    return {
      type: 'tool',
      id: event.data.id,
      name,
      executed: event.data.executed,
      state: {
        status: 'completed',
        input,
        content: event.data.content,
        metadata: asRecord(event.data.metadata),
      },
      time: { created, completed: created },
    };
  }

  return {
    type: 'tool',
    id: event.data.id,
    name,
    executed: event.data.executed,
    state: {
      status: 'error',
      input,
      error: event.data.error,
      content: event.data.content as TToolResultContent | undefined,
      metadata: asRecord(event.data.metadata),
    },
    time: { created, completed: created },
  };
};

/**
 * Inserta o actualiza una parte de tool a partir de su evento. La parte se
 * construye con el `existing` a la vista para heredar `name` e `input`, que los
 * eventos `tool.success`/`tool.failed` no repiten.
 */
export const upsertToolPart = (
  prev: unknown,
  messageID: string,
  event: TToolEvent,
  created: number,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => {
    const existing = message.parts.find(
      (p): p is TToolPart => p.type === 'tool' && p.id === event.data.id,
    );
    const part = toolPartFrom(event, created, existing);
    const rest = message.parts.filter(
      (p) => !(p.type === 'tool' && p.id === event.data.id),
    );
    return withParts(message, [...rest, part]);
  });
