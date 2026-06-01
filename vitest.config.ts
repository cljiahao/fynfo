import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      // server-only throws at runtime in non-RSC contexts (jsdom/vitest).
      // Stub it so server-only modules can be imported in unit tests.
      'server-only': path.resolve(rootDir, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    passWithNoTests: true,
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
      // Enforced on `pnpm test:coverage`. Global is a low floor that prevents
      // regression below today's baseline (most UI is still untested pending
      // the jsdom/RTL decision); ratchet up as coverage grows. The security
      // core is gated high to keep the zero-knowledge contract locked down.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 50,
        branches: 60,
        'src/lib/crypto.ts': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 90,
        },
        'src/lib/action-guard.ts': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 90,
        },
        'src/lib/keystore.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
      },
    },
  },
});
