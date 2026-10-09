import { describe, expect, it } from 'vitest';
import {
  formatDateTimeRange,
  formatTimeRange,
  type TTimeRangeInput,
} from '../formatTimeRange';

const pad = (value: number): string => String(value).padStart(2, '0');

const clock = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const stamp = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();

const input = (overrides: Partial<TTimeRangeInput> = {}): TTimeRangeInput => ({
  startedAt: START,
  endedAt: END,
  isRunning: false,
  ...overrides,
});

describe('formatTimeRange', () => {
  it('formats both endpoints as a compact HH:mm → HH:mm range', () => {
    expect(formatTimeRange(input())).toBe(`${clock(START)} → ${clock(END)}`);
  });

  it('shows "en curso" while running, even when endedAt is present', () => {
    expect(formatTimeRange(input({ isRunning: true }))).toBe(
      `${clock(START)} → en curso`,
    );
    expect(formatTimeRange(input({ endedAt: END, isRunning: true }))).toBe(
      `${clock(START)} → en curso`,
    );
  });

  it('shows "no disponible" when endedAt is missing and not running', () => {
    expect(formatTimeRange(input({ endedAt: null }))).toBe(
      `${clock(START)} → no disponible`,
    );
  });

  it('shows "no disponible" when startedAt is missing', () => {
    expect(formatTimeRange(input({ startedAt: null }))).toBe(
      `no disponible → ${clock(END)}`,
    );
  });

  it('shows "no disponible" on both ends when both are missing', () => {
    expect(formatTimeRange(input({ startedAt: null, endedAt: null }))).toBe(
      'no disponible → no disponible',
    );
  });

  it('renders each present endpoint as a zero-padded hour:minute clock', () => {
    const hhmm = /\d{2}:\d{2}/;
    const [start, end] = formatTimeRange(input()).split(' → ');

    expect(clock(START)).toMatch(hhmm);
    expect(start).toMatch(hhmm);
    expect(end).toMatch(hhmm);
  });
});

describe('formatDateTimeRange', () => {
  it('formats both endpoints as `dd/mm HH:mm`', () => {
    expect(formatDateTimeRange(input())).toBe(
      `${stamp(START)} – ${stamp(END)}`,
    );
  });

  it('shows "en curso" while running, even when endedAt is present', () => {
    expect(formatDateTimeRange(input({ isRunning: true }))).toBe(
      `${stamp(START)} – en curso`,
    );
  });

  it('shows "no disponible" when an endpoint is missing', () => {
    expect(formatDateTimeRange(input({ endedAt: null }))).toBe(
      `${stamp(START)} – no disponible`,
    );
    expect(formatDateTimeRange(input({ startedAt: null }))).toBe(
      `no disponible – ${stamp(END)}`,
    );
  });

  it('includes the date, not just the clock', () => {
    const [start, end] = formatDateTimeRange(input()).split(' – ');

    expect(start).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(end).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});
