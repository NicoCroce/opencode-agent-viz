import { describe, expect, it } from 'vitest';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import { toolsFromMessages } from '../toolsFromMessages';

type TToolTime = Extract<TContentPart, { type: 'tool' }>['time'];

const toolPart = (name: string, time: TToolTime): TContentPart => ({
  type: 'tool',
  id: `call_${name}`,
  name,
  state: { status: 'completed', input: {}, content: [{ type: 'text', text: 'ok' }] },
  time,
});

const assistant = (parts: TContentPart[]): TSessionMessage =>
  ({
    info: { type: 'assistant', content: parts },
    parts,
  }) as unknown as TSessionMessage;

describe('toolsFromMessages', () => {
  it('mide desde que la herramienta se ejecuta (time.ran), no desde que el modelo empieza a escribir la llamada', () => {
    const [entry] = toolsFromMessages([
      assistant([toolPart('write', { created: 1000, ran: 5000, completed: 5010 })]),
    ]);

    expect(entry.startedAt).toBe(5000);
    expect(entry.endedAt).toBe(5010);
  });

  it('usa time.created cuando el servidor no reporta time.ran (sesiones antiguas)', () => {
    const [entry] = toolsFromMessages([
      assistant([toolPart('read', { created: 1000, completed: 1300 })]),
    ]);

    expect(entry.startedAt).toBe(1000);
  });

  it('conserva el orden de aparición y descarta lo que no es herramienta', () => {
    const entries = toolsFromMessages([
      assistant([
        { type: 'text', text: 'hola' },
        toolPart('read', { created: 1, ran: 2, completed: 3 }),
      ]),
      assistant([toolPart('edit', { created: 4, ran: 5 })]),
    ]);

    expect(entries.map((entry) => entry.name)).toEqual(['read', 'edit']);
    expect(entries[1].endedAt).toBeUndefined();
  });
});
