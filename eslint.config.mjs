import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  eslintComments.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  {
    plugins: { sonarjs },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/disable-enable-pair': [
        'error',
        { allowWholeFile: true },
      ],
      'sonarjs/no-commented-code': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-inline-comments': [
        'error',
        {
          ignorePattern:
            '^\\s*(?:eslint-|@ts-|prettier-|(?:istanbul|c8|v8) ignore)',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ThrowStatement > NewExpression[callee.name='Error'] Identifier[name='message']",
          message:
            'Do not throw `new Error(supabaseError.message)` — use throwIfSupabaseError() from @/lib/errors to keep DB detail server-side.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Import from the feature barrel (@/features/<name>), not its internals (constitution 2.6).',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'public/pdfjs/**',
    'next-env.d.ts',
    // Harness scripts have a separate permission-protected review surface.
    '.claude/**',
  ]),
]);

export default eslintConfig;
