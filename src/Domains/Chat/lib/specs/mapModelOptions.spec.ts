import { describe, expect, it } from 'vitest';
import type { ModelInfo, ModelVariant } from '@opencode/client';
import type { TReasoningOption } from '@app/Domains/Chat/Chat.entity';
import { mapModelOptions } from '../mapModelOptions';

/**
 * P6 / data-model §2.4 (`contracts/chat-panel-contract.md` §3, research R7):
 * proyección **pura** `ModelInfo[]` → `TModelOption[]`. El razonamiento se deriva
 * de `ModelInfo.variants` (`ModelVariant.id` **es** la variante): modelo sin
 * variantes → lista vacía y el envío sigue funcionando.
 */

const variant = (id: string): ModelVariant => ({ id });

const model = (
  overrides: Partial<ModelInfo> & Pick<ModelInfo, 'id' | 'name' | 'providerID'>,
): ModelInfo =>
  ({
    variants: [],
    ...overrides,
  }) as unknown as ModelInfo;

describe('mapModelOptions', () => {
  it('projects each model to a TModelOption with id, label and base ref', () => {
    const [option] = mapModelOptions([
      model({ id: 'gpt-5', name: 'GPT-5', providerID: 'openai' }),
    ]);

    expect(option).toMatchObject({
      id: 'gpt-5',
      label: 'GPT-5',
      ref: { id: 'gpt-5', providerID: 'openai' },
    });
  });

  it('derives reasoning options from ModelInfo.variants (value/label = variant.id)', () => {
    const [option] = mapModelOptions([
      model({
        id: 'gpt-5',
        name: 'GPT-5',
        providerID: 'openai',
        variants: [variant('low'), variant('high')],
      }),
    ]);

    expect(option.reasoning).toEqual<TReasoningOption[]>([
      { value: 'low', label: 'low' },
      { value: 'high', label: 'high' },
    ]);
  });

  it('returns an empty reasoning list when the model has no variants (P6)', () => {
    const [option] = mapModelOptions([
      model({ id: 'plain', name: 'Plain', providerID: 'local' }),
    ]);

    expect(option.reasoning).toEqual([]);
  });

  it('keeps the base ref without a variant key', () => {
    const [option] = mapModelOptions([
      model({
        id: 'gpt-5',
        name: 'GPT-5',
        providerID: 'openai',
        variants: [variant('high')],
      }),
    ]);

    expect(option.ref).not.toHaveProperty('variant');
  });

  it('maps every model preserving the input order', () => {
    const options = mapModelOptions([
      model({ id: 'a', name: 'A', providerID: 'p1' }),
      model({ id: 'b', name: 'B', providerID: 'p2', variants: [variant('x')] }),
    ]);

    expect(options.map((option) => option.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list for no models', () => {
    expect(mapModelOptions([])).toEqual([]);
  });

  it('does not mutate the input models', () => {
    const input = [
      model({
        id: 'gpt-5',
        name: 'GPT-5',
        providerID: 'openai',
        variants: [variant('low')],
      }),
    ];
    const snapshot = structuredClone(input);

    mapModelOptions(input);

    expect(input).toEqual(snapshot);
  });
});
