import { afterEach, describe, expect, it } from 'vitest';
import {
  ANOMALY_THRESHOLD_STORAGE_KEY,
  DEFAULT_ANOMALY_THRESHOLD,
  clampThreshold,
  readStoredThreshold,
  writeStoredThreshold,
} from '../metrics/anomalyThreshold';

describe('clampThreshold · L7 (FR-022)', () => {
  it('el default es 0.4 (±40%)', () => {
    expect(DEFAULT_ANOMALY_THRESHOLD).toBe(0.4);
  });

  it('acota al rango (0.05, 0.95)', () => {
    expect(clampThreshold(0.5)).toBe(0.5);
    expect(clampThreshold(0)).toBe(0.05);
    expect(clampThreshold(-1)).toBe(0.05);
    expect(clampThreshold(1)).toBe(0.95);
    expect(clampThreshold(2)).toBe(0.95);
  });

  it('cae al default con valores no finitos', () => {
    expect(clampThreshold(Number.NaN)).toBe(DEFAULT_ANOMALY_THRESHOLD);
    expect(clampThreshold(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_ANOMALY_THRESHOLD,
    );
  });
});

describe('persistencia del umbral', () => {
  afterEach(() => localStorage.clear());

  it('sin valor guardado usa el default', () => {
    expect(readStoredThreshold()).toBe(DEFAULT_ANOMALY_THRESHOLD);
  });

  it('guarda y lee el umbral acotado', () => {
    writeStoredThreshold(0.6);
    expect(readStoredThreshold()).toBe(0.6);

    writeStoredThreshold(5);
    expect(readStoredThreshold()).toBe(0.95);
    expect(localStorage.getItem(ANOMALY_THRESHOLD_STORAGE_KEY)).toBe('0.95');
  });
});
