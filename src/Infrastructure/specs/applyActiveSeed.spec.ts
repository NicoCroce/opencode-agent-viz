import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '@opencode/client';
import { applyActiveSeed } from '../EventStreamProvider';

const busy: SessionStatus = { type: 'busy' };
const idle: SessionStatus = { type: 'idle' };
const retry: SessionStatus = {
  type: 'retry',
  attempt: 1,
  message: 'rate limited',
  next: 1000,
};

describe('applyActiveSeed', () => {
  it('reset reemplaza el mapa y limpia la lista de ausentes', () => {
    const missing = new Set(['stale']);
    const next = applyActiveSeed(
      { old: busy, keep: idle },
      { keep: busy },
      { reset: true, missing },
    );

    expect(next).toEqual({ keep: busy });
    expect(missing.size).toBe(0);
  });

  it('incremental agrega las activas y preserva el detalle retry', () => {
    const next = applyActiveSeed(
      { retrying: retry },
      { retrying: busy, fresh: busy },
      { reset: false, missing: new Set() },
    );

    expect(next.retrying).toEqual(retry);
    expect(next.fresh).toEqual(busy);
  });

  it('no degrada un busy ausente al primer sondeo (gracia)', () => {
    const missing = new Set<string>();
    const next = applyActiveSeed({ gone: busy }, {}, { reset: false, missing });

    expect(next.gone).toEqual(busy);
    expect(missing.has('gone')).toBe(true);
  });

  it('degrada a idle al segundo sondeo consecutivo ausente', () => {
    const missing = new Set<string>();
    applyActiveSeed({ gone: busy }, {}, { reset: false, missing });
    const next = applyActiveSeed({ gone: busy }, {}, { reset: false, missing });

    expect(next.gone).toEqual(idle);
    expect(missing.has('gone')).toBe(false);
  });

  it('si vuelve a estar activa, cancela la degradación pendiente', () => {
    const missing = new Set<string>();
    applyActiveSeed({ s: busy }, {}, { reset: false, missing });
    const next = applyActiveSeed({ s: busy }, { s: busy }, {
      reset: false,
      missing,
    });

    expect(next.s).toEqual(busy);
    expect(missing.has('s')).toBe(false);
  });

  it('no degrada estados que no son busy', () => {
    const missing = new Set<string>();
    const next = applyActiveSeed({ done: idle }, {}, { reset: false, missing });

    expect(next.done).toEqual(idle);
    expect(missing.size).toBe(0);
  });
});
