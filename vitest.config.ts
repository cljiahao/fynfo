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
    // Four workers caused DOM-test timeouts on the dev host (spec082).
    maxWorkers: 2,
    passWithNoTests: false,
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
      // Global floors require more than 80% coverage across the source tree.
      // Per-file gates protect cryptography and server-action boundaries.
      thresholds: {
        lines: 81,
        statements: 81,
        functions: 81,
        branches: 81,
        'src/features/auth/hooks/use-auth-identity.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/features/auth/components/vault-lock-context.tsx': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
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
        // Client-side DEK derivation — the only PIN->DEK path (spec 057).
        'src/lib/client-crypto.ts': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 90,
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
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 45,
        },
        'src/features/assets/actions/snapshot-actions.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 60,
        },
        'src/features/salary/actions/relief-actions.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 60,
        },
        // Pure SG tax-relief logic (spec 038). Lines/funcs fully covered;
        // branch floor sits just under the residual label-fallback edges.
        'src/features/salary/lib/tax-reliefs.ts': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 85,
        },
        // Spec 037 — remainder of the action layer.
        'src/features/assets/actions/planner-actions.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 70,
        },
        'src/features/expenses/actions/expense-actions.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 55,
        },
        // Spec 039 — dividend tracking (actions + pure libs).
        'src/features/equity/actions/dividend-actions.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 45,
        },
        'src/features/equity/lib/dividend-suggest.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/features/equity/lib/dividend-metrics.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        // Spec 042 — dividend scan candidate builder.
        'src/features/equity/lib/dividend-scan.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 70,
        },
        // Spec 049 — math extracted out of components into gated libs.
        'src/features/equity/lib/mwr.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/features/expenses/lib/owed.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        // Spec 053 — household core: key-wrapping lib, session keystore, actions.
        'src/lib/household-key.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/lib/household-keystore.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/features/household/actions/household-actions.ts': {
          lines: 85,
          statements: 85,
          functions: 100,
          branches: 55,
        },
        // Spec 054 — household MVP goals.
        'src/features/household/lib/goal-progress.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'src/features/household/actions/goal-actions.ts': {
          lines: 85,
          statements: 85,
          functions: 100,
          branches: 55,
        },
      },
    },
  },
});
