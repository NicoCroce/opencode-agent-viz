import { describe, expect, it } from 'vitest';
import {
  clampPanelWidth,
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  INSPECTOR_STEP,
} from '../panelWidth';

describe('panelWidth constants', () => {
  it('defines the current 360px width as the default', () => {
    expect(INSPECTOR_DEFAULT_WIDTH).toBe(360);
  });

  it('keeps the default width within the allowed range', () => {
    expect(INSPECTOR_DEFAULT_WIDTH).toBeGreaterThanOrEqual(INSPECTOR_MIN_WIDTH);
    expect(INSPECTOR_DEFAULT_WIDTH).toBeLessThanOrEqual(INSPECTOR_MAX_WIDTH);
  });

  it('uses a coherent (positive, ordered) min/max range', () => {
    expect(INSPECTOR_MIN_WIDTH).toBeGreaterThan(0);
    expect(INSPECTOR_MIN_WIDTH).toBeLessThan(INSPECTOR_MAX_WIDTH);
  });

  it('uses a positive keyboard step smaller than the usable range', () => {
    expect(INSPECTOR_STEP).toBeGreaterThan(0);
    expect(INSPECTOR_STEP).toBeLessThanOrEqual(
      INSPECTOR_MAX_WIDTH - INSPECTOR_MIN_WIDTH,
    );
  });
});

describe('clampPanelWidth', () => {
  it('returns the value unchanged when it is within the range', () => {
    expect(clampPanelWidth(INSPECTOR_DEFAULT_WIDTH)).toBe(
      INSPECTOR_DEFAULT_WIDTH,
    );
    expect(clampPanelWidth(INSPECTOR_MIN_WIDTH + 1)).toBe(
      INSPECTOR_MIN_WIDTH + 1,
    );
  });

  it('keeps the exact boundaries unchanged', () => {
    expect(clampPanelWidth(INSPECTOR_MIN_WIDTH)).toBe(INSPECTOR_MIN_WIDTH);
    expect(clampPanelWidth(INSPECTOR_MAX_WIDTH)).toBe(INSPECTOR_MAX_WIDTH);
  });

  it('clamps values below the minimum up to the minimum', () => {
    expect(clampPanelWidth(INSPECTOR_MIN_WIDTH - 1)).toBe(INSPECTOR_MIN_WIDTH);
    expect(clampPanelWidth(0)).toBe(INSPECTOR_MIN_WIDTH);
    expect(clampPanelWidth(-500)).toBe(INSPECTOR_MIN_WIDTH);
  });

  it('clamps values above the maximum down to the maximum', () => {
    expect(clampPanelWidth(INSPECTOR_MAX_WIDTH + 1)).toBe(INSPECTOR_MAX_WIDTH);
    expect(clampPanelWidth(10_000)).toBe(INSPECTOR_MAX_WIDTH);
  });

  it('sanitizes NaN to the default width', () => {
    expect(clampPanelWidth(Number.NaN)).toBe(INSPECTOR_DEFAULT_WIDTH);
  });

  it('sanitizes non-finite values to the default width', () => {
    expect(clampPanelWidth(Number.POSITIVE_INFINITY)).toBe(
      INSPECTOR_DEFAULT_WIDTH,
    );
    expect(clampPanelWidth(Number.NEGATIVE_INFINITY)).toBe(
      INSPECTOR_DEFAULT_WIDTH,
    );
  });
});
