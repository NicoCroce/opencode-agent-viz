import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '@opencode/client';
import { isActiveStatus, toNodeStatus } from '../nodeStatus';

type NodeStatusInput = Parameters<typeof toNodeStatus>[0];

const input = (overrides: Partial<NodeStatusInput> = {}): NodeStatusInput => ({
  hasActivity: false,
  hasPermission: false,
  hasPendingForm: false,
  compaction: null,
  outcome: null,
  lastAssistantErrored: false,
  ...overrides,
});

const retryStatus: SessionStatus = {
  type: 'retry',
  attempt: 2,
  message: 'rate limited',
  next: 1_234,
};

const busyStatus: SessionStatus = { type: 'busy' };
const idleStatus: SessionStatus = { type: 'idle' };

describe('toNodeStatus', () => {
  describe('los 9 estados', () => {
    it('sin actividad ni señal → created (FR-021)', () => {
      expect(toNodeStatus(input())).toBe('created');
    });

    it('con actividad y sin outcome → succeeded (FR-021)', () => {
      expect(toNodeStatus(input({ hasActivity: true }))).toBe('succeeded');
    });

    it('con actividad y último assistant con error → failed', () => {
      expect(
        toNodeStatus(input({ hasActivity: true, lastAssistantErrored: true })),
      ).toBe('failed');
    });

    it('status busy sin outcome → running', () => {
      expect(toNodeStatus(input({ status: busyStatus }))).toBe('running');
    });

    it('status retry → retrying (FR-018)', () => {
      expect(toNodeStatus(input({ status: retryStatus }))).toBe('retrying');
    });

    it('compaction running → compacting', () => {
      expect(toNodeStatus(input({ compaction: 'running' }))).toBe('compacting');
    });

    it('hasPendingForm → waiting-input', () => {
      expect(toNodeStatus(input({ hasPendingForm: true }))).toBe(
        'waiting-input',
      );
    });

    it('hasPermission → waiting-permission', () => {
      expect(toNodeStatus(input({ hasPermission: true }))).toBe(
        'waiting-permission',
      );
    });

    it('outcome interrupted → interrupted (FR-019)', () => {
      expect(toNodeStatus(input({ outcome: 'interrupted' }))).toBe(
        'interrupted',
      );
    });

    it('outcome failed → failed', () => {
      expect(toNodeStatus(input({ outcome: 'failed' }))).toBe('failed');
    });

    it('outcome succeeded → succeeded', () => {
      expect(toNodeStatus(input({ outcome: 'succeeded' }))).toBe('succeeded');
    });
  });

  describe('prioridad exacta del contrato', () => {
    it('retry gana sobre compaction, esperas y outcome', () => {
      expect(
        toNodeStatus(
          input({
            status: retryStatus,
            compaction: 'running',
            hasPendingForm: true,
            hasPermission: true,
            outcome: 'failed',
          }),
        ),
      ).toBe('retrying');
    });

    it('compaction running gana sobre esperas y outcome', () => {
      expect(
        toNodeStatus(
          input({
            compaction: 'running',
            hasPendingForm: true,
            hasPermission: true,
            outcome: 'failed',
          }),
        ),
      ).toBe('compacting');
    });

    it('waiting-input gana sobre waiting-permission y outcome', () => {
      expect(
        toNodeStatus(
          input({
            hasPendingForm: true,
            hasPermission: true,
            outcome: 'failed',
          }),
        ),
      ).toBe('waiting-input');
    });

    it('waiting-permission gana sobre outcome', () => {
      expect(
        toNodeStatus(input({ hasPermission: true, outcome: 'failed' })),
      ).toBe('waiting-permission');
    });

    it('outcome terminal gana sobre busy (FR-020)', () => {
      expect(toNodeStatus(input({ status: busyStatus, outcome: 'failed' }))).toBe(
        'failed',
      );
      expect(
        toNodeStatus(input({ status: busyStatus, outcome: 'succeeded' })),
      ).toBe('succeeded');
      expect(
        toNodeStatus(input({ status: busyStatus, outcome: 'interrupted' })),
      ).toBe('interrupted');
    });

    it('outcome terminal gana sobre hasActivity', () => {
      expect(
        toNodeStatus(input({ hasActivity: false, outcome: 'succeeded' })),
      ).toBe('succeeded');
    });
  });

  describe('FR-020 — un error superado no tiñe el estado', () => {
    it('busy con error previo sigue running, no failed', () => {
      expect(
        toNodeStatus(input({ status: busyStatus, lastAssistantErrored: true })),
      ).toBe('running');
    });

    it('una espera activa con error previo no es failed', () => {
      expect(
        toNodeStatus(input({ hasPermission: true, lastAssistantErrored: true })),
      ).toBe('waiting-permission');
      expect(
        toNodeStatus(
          input({ hasPendingForm: true, lastAssistantErrored: true }),
        ),
      ).toBe('waiting-input');
    });

    it('un outcome succeeded con error previo sigue succeeded', () => {
      expect(
        toNodeStatus(
          input({
            status: busyStatus,
            outcome: 'succeeded',
            lastAssistantErrored: true,
          }),
        ),
      ).toBe('succeeded');
    });

    it('lastAssistantErrored solo aplica sin outcome ni estado activo', () => {
      expect(
        toNodeStatus(input({ hasActivity: true, lastAssistantErrored: true })),
      ).toBe('failed');
    });
  });

  it('status idle sin actividad → created', () => {
    expect(toNodeStatus(input({ status: idleStatus }))).toBe('created');
  });
});

describe('isActiveStatus', () => {
  it.each([
    'running',
    'retrying',
    'compacting',
    'waiting-permission',
    'waiting-input',
  ] as const)('es activo: %s', (status) => {
    expect(isActiveStatus(status)).toBe(true);
  });

  it.each(['created', 'succeeded', 'failed', 'interrupted'] as const)(
    'no es activo: %s',
    (status) => {
      expect(isActiveStatus(status)).toBe(false);
    },
  );
});
