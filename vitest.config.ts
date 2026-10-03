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
