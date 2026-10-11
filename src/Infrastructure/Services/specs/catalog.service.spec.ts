import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelInfo } from '@opencode/client';
import { opencodeClient } from '../client';
import { catalogReadService } from '../catalog.service';

/**
 * Lectura del catálogo de modelos (FR-008; contrato `write-facade-contract.md`
 * §1, T005). Se mockea la frontera del cliente (`opencodeClient.model.*`) y se
 * asserta que el `directory` se reenvía como `location` y que la `data`
 * desempaquetada se devuelve tal cual. Canon: `opencodeClient.spec.ts`.
 */
const model = (overrides: Partial<ModelInfo> = {}): ModelInfo =>
  ({
    id: 'gpt-5',
    name: 'GPT-5',
    providerID: 'openai',
    variants: [],
    ...overrides,
  }) as unknown as ModelInfo;

describe('catalogReadService.listModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reenvía el directory como location y devuelve la data', async () => {
    const models = [model()];
    const list = vi
      .spyOn(opencodeClient.model, 'list')
      .mockResolvedValue({ data: models } as never);

    await expect(catalogReadService.listModels('/repo')).resolves.toBe(models);
    expect(list).toHaveBeenCalledWith({ location: { directory: '/repo' } });
  });

  it('acepta la llamada sin directory (location sin valor)', async () => {
    const list = vi
      .spyOn(opencodeClient.model, 'list')
      .mockResolvedValue({ data: [] } as never);

    await expect(catalogReadService.listModels()).resolves.toEqual([]);
    expect(list).toHaveBeenCalledWith({ location: { directory: undefined } });
  });
});

describe('catalogReadService.getDefaultModel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reenvía el directory y devuelve el modelo por defecto', async () => {
    const fallback = model({ id: 'claude', providerID: 'anthropic' });
    const getDefault = vi
      .spyOn(opencodeClient.model, 'default')
      .mockResolvedValue({ data: fallback } as never);

    await expect(catalogReadService.getDefaultModel('/repo')).resolves.toBe(
      fallback,
    );
    expect(getDefault).toHaveBeenCalledWith({ location: { directory: '/repo' } });
  });
});
