import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '@opencode/client';
import {
  contextUsageLevel,
  deriveContextUsage,
  findContextLimit,
} from '../contextUsage';

const model = (
  overrides: Partial<Pick<ModelInfo, 'id' | 'modelID' | 'providerID'>> & {
    context?: number;
  } = {},
): ModelInfo =>
  ({
    id: overrides.id ?? 'claude-opus-5.5',
    modelID: overrides.modelID ?? 'claude-opus-5.5',
    providerID: overrides.providerID ?? 'github-copilot',
    limit: { context: overrides.context ?? 200_000, output: 32_000 },
  }) as ModelInfo;

describe('findContextLimit', () => {
  it('devuelve el límite de contexto del modelo del nodo', () => {
    const models = [
      model({ id: 'gpt-5', modelID: 'gpt-5', context: 400_000 }),
      model({ context: 200_000 }),
    ];

    expect(
      findContextLimit(models, { id: 'claude-opus-5.5', providerID: 'github-copilot' }),
    ).toBe(200_000);
  });

  it('acepta que la referencia coincida con el modelID del proveedor', () => {
    const models = [model({ id: 'opus', modelID: 'claude-opus-5.5', context: 1_000_000 })];

    expect(
      findContextLimit(models, { id: 'claude-opus-5.5', providerID: 'github-copilot' }),
    ).toBe(1_000_000);
  });

  it('prefiere la coincidencia por id frente a la de modelID', () => {
    const models = [
      model({ id: 'otro', modelID: 'opus', context: 1_000 }),
      model({ id: 'opus', modelID: 'x', context: 2_000 }),
    ];

    expect(findContextLimit(models, { id: 'opus', providerID: 'github-copilot' })).toBe(2_000);
  });

  it('no mezcla proveedores: el mismo id en otro proveedor no cuenta', () => {
    const models = [model({ providerID: 'anthropic', context: 500_000 })];

    expect(
      findContextLimit(models, { id: 'claude-opus-5.5', providerID: 'github-copilot' }),
    ).toBeNull();
  });

  it('sin modelo en el nodo, o con límite no positivo, no hay límite', () => {
    expect(findContextLimit([model()], null)).toBeNull();
    expect(
      findContextLimit([model({ context: 0 })], {
        id: 'claude-opus-5.5',
        providerID: 'github-copilot',
      }),
    ).toBeNull();
  });
});

describe('deriveContextUsage', () => {
  it('calcula la fracción usada de la ventana', () => {
    expect(deriveContextUsage(50_000, 200_000)).toEqual({
      usedTokens: 50_000,
      limitTokens: 200_000,
      ratio: 0.25,
    });
  });

  it('no recorta por encima del 100 %: el dato se muestra tal cual', () => {
    expect(deriveContextUsage(210_000, 200_000)?.ratio).toBeCloseTo(1.05);
  });

  it('sin tokens usados o sin límite no hay uso (nunca 0 % inventado)', () => {
    expect(deriveContextUsage(null, 200_000)).toBeNull();
    expect(deriveContextUsage(50_000, null)).toBeNull();
  });
});

describe('contextUsageLevel', () => {
  it('es normal por debajo del 70 %, alto desde el 70 % y crítico desde el 90 %', () => {
    expect(contextUsageLevel(0.69)).toBe('normal');
    expect(contextUsageLevel(0.7)).toBe('high');
    expect(contextUsageLevel(0.89)).toBe('high');
    expect(contextUsageLevel(0.9)).toBe('critical');
    expect(contextUsageLevel(1.2)).toBe('critical');
  });
});
