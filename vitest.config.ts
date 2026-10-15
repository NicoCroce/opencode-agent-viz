import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@app', replacement: resolve(__dirname, 'src') },
      { find: '@', replacement: resolve(__dirname, './src') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['src/**/*.spec.ts', 'node']],
    // 4 workers = núcleos de rendimiento de un M1; más allá el beneficio es marginal.
    pool: 'threads',
    poolOptions: { threads: { minThreads: 1, maxThreads: 4 } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/Domains/**/*.{ts,tsx}'],
      exclude: [
        'src/Domains/**/*.{routes,router}.tsx',
        'src/Domains/**/Pages/**',
        'src/Domains/**/index.ts',
      ],
    },
  },
});
