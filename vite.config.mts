import { defineConfig } from 'vite-plus'

/**
 * Single source of truth for the kitz toolchain: lint, format, test, and tasks
 * all live here (no .oxlintrc.json / .oxfmtrc.json / .prettierignore).
 */

export default defineConfig({
  // ── create (vp create package — dependency-free scaffolder) ──────────────
  create: {
    templates: [
      {
        name: 'package',
        description: 'Scaffold a new @kitz package.',
        template: './generators/package',
      },
    ],
  },

  // ── oxlint ──────────────────────────────────────────────────────────────
  lint: {
    plugins: ['typescript', 'import', 'vitest', 'promise'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      perf: 'warn',
    },
    rules: {
      'eslint/no-unused-vars': 'off',
      'eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true }],
      'eslint/no-control-regex': 'off',
      'eslint/no-shadow': 'off',
      'eslint/no-underscore-dangle': 'off',
      'typescript/no-explicit-any': 'off',
      'typescript/no-unsafe-type-assertion': 'off',
      'typescript/unbound-method': 'off',
      'typescript/no-unnecessary-type-assertion': 'warn',
      'eslint-plugin-jest/expect-expect': 'off',
      'eslint-plugin-jest/no-standalone-expect': 'off',
      'eslint-plugin-jest/no-conditional-expect': 'off',
      'eslint-plugin-jest/valid-title': 'off',
      'eslint-plugin-import/no-unassigned-import': 'off',
      // TypeScript owns namespace-member resolution (tsc rejects unknown
      // members); this rule duplicates it and contradicts deliberate
      // `@ts-expect-error` probes of absent public members in tests.
      'eslint-plugin-import/namespace': 'off',
      'eslint-plugin-promise/no-new-statics': 'warn',
      'eslint-plugin-promise/no-callback-in-promise': 'warn',
      'eslint-plugin-promise/prefer-await-to-then': 'off',
    },
    overrides: [
      {
        files: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/__tests/**'],
        rules: {
          'typescript/await-thenable': 'off',
          'eslint-plugin-unicorn/no-thenable': 'off',
          'eslint-plugin-vitest/warn-todo': 'warn',
        },
      },
    ],
    ignorePatterns: [
      '**/build/**',
      '**/.tsbuild/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/__examples/**',
    ],
  },

  // ── oxfmt ───────────────────────────────────────────────────────────────
  fmt: {
    singleQuote: true,
    semi: false,
    ignorePatterns: [
      '**/build/**',
      '**/.tsbuild/**',
      '**/coverage/**',
      '**/__snapshots__/**',
      '**/node_modules/**',
      '.claude/**',
      'docs/**',
      'pnpm-lock.yaml',
    ],
  },

  // ── vitest ──────────────────────────────────────────────────────────────
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    setupFiles: ['@kitz/vitest/setup'],
    environment: 'node',
  },

  // ── tasks: wrap non-vp tools (tsc/publint/attw) or compose steps. ─────────
  // First-class vp commands (lint, format, test) are run directly, not aliased.
  run: {
    tasks: {
      build: 'tsc -b tsconfig.production.json',
      'check:types': 'tsc -b tsconfig.development.json',
      'check:package': {
        command:
          'publint && attw --pack --ignore-rules no-resolution cjs-resolves-to-esm internal-resolution-error',
        cwd: 'packages/effect',
        dependsOn: ['build'],
      },
      check: {
        command: ['vp format --check', 'vp lint', 'tsc -b tsconfig.development.json'],
      },
      fix: {
        command: ['vp format', 'vp lint --fix'],
      },
    },
  },

  // ── staged (used by the pre-commit hook via `vp staged`) ──────────────────
  // --no-error-on-unmatched-pattern: a staged set whose files are all
  // tool-ignored (e.g. pnpm-lock.yaml, a .claude-only docs commit) must
  // no-op, not fail. oxfmt/oxlint own the ignore list — we don't mirror it.
  staged: {
    '**/*.{ts,mts,cts,tsx}': [
      'vp format --no-error-on-unmatched-pattern',
      'vp lint --no-error-on-unmatched-pattern',
    ],
    '**/*.{js,mjs,cjs,json,jsonc,md,yaml,yml}': 'vp format --no-error-on-unmatched-pattern',
  },
})
