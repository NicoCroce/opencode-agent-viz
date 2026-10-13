import { describe, expect, it } from 'vitest';
import { formatPercent } from '../formatPercent';

describe('formatPercent', () => {
  it('formatea un porcentaje con 0 decimales por defecto', () => {
    expect(formatPercent(47.4)).toBe('47%');
    expect(formatPercent(26)).toBe('26%');
  });

  it('respeta los decimales pedidos', () => {
    expect(formatPercent(47.456, 1)).toBe('47.5%');
  });

  it('cae a "no disponible" con valores ausentes o no finitos', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
