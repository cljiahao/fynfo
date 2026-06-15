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
      // core + the server-action layer are gated per-file to keep the
      // zero-knowledge + encrypt-on-write contracts locked down.
      // Re-baselined after spec 035 (action-layer tests): all-files lines
      // ~36 / stmts ~35 / funcs ~24 / branches ~25.
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 20,
        branches: 20,
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
        // Server-action layer (spec 035). Floors sit a few points below the
        // measured coverage so the gain can't silently regress.
        'src/features/equity/actions/price-actions.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 80,
        },
        'src/features/profile/actions/profile-actions.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 75,
        },
        'src/features/equity/actions/equity-actions.ts': {
          lines: 70,
          statements: 70,
          functions: 75,
          branches: 45,
        },
        'src/features/assets/actions/snapshot-actions.ts': {
          lines: 72,
          statements: 72,
          functions: 72,
          branches: 30,
        },
        'src/features/salary/actions/relief-actions.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 60,
        },
      },
    },
  },
});
