import { describe, expect, it } from 'vitest';
import { formatClock } from '../format/clock';
import { UNAVAILABLE, UNAVAILABLE_LABEL } from '../format/constants';

describe('format constants', () => {
  it('exposes the short unavailable marker', () => {
    expect(UNAVAILABLE).toBe('—');
  });

  it('exposes the long unavailable label', () => {
    expect(UNAVAILABLE_LABEL).toBe('no disponible');
  });
});

describe('formatClock', () => {
  const at = (hours: number, minutes: number): number =>
    new Date(2024, 0, 15, hours, minutes, 0, 0).getTime();

  it('formats midnight as 00:00', () => {
    expect(formatClock(at(0, 0))).toBe('00:00');
  });

  it('pads hours and minutes to two digits', () => {
    expect(formatClock(at(9, 5))).toBe('09:05');
  });

  it('formats the end of the day as 23:59', () => {
    expect(formatClock(at(23, 59))).toBe('23:59');
  });

  it('uses a 24-hour clock', () => {
    expect(formatClock(at(13, 30))).toBe('13:30');
  });
});
