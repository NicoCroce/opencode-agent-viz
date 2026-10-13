import { describe, expect, it } from 'vitest';
import { formatSpeedup } from '../formatSpeedup';

describe('formatSpeedup', () => {
  it('formatea una aceleración con el prefijo × y 1 decimal por defecto', () => {
    expect(formatSpeedup(2.45)).toBe('×2.5');
    expect(formatSpeedup(3)).toBe('×3.0');
  });

  it('respeta los decimales pedidos', () => {
    expect(formatSpeedup(2.456, 2)).toBe('×2.46');
  });

  it('cae a "no disponible" con valores ausentes o no finitos', () => {
    expect(formatSpeedup(null)).toBe('—');
    expect(formatSpeedup(undefined)).toBe('—');
    expect(formatSpeedup(Number.NaN)).toBe('—');
    expect(formatSpeedup(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
