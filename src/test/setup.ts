import { afterEach, vi } from 'vitest';

// Los specs `.spec.ts` corren en `node` (ver vitest.config.ts): las piezas de DOM
// solo se cargan cuando el entorno es jsdom, para no pagar su costo en cada archivo.
const hasDom = typeof document !== 'undefined';

if (hasDom) {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  const { installRadixPolyfills } = await import('./radix');

  installRadixPolyfills();

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
