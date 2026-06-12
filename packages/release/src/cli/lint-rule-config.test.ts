import { describe, expect, test } from 'bun:test'
import * as Api from '../api/__.js'
import { testConfig } from '../test-support.js'
import { createCommandLintConfig } from './lint-rule-config.js'

const makeResolvedConfig = (
  lint: Partial<typeof Api.Lint.ResolvedConfig.Type> = {},
): Api.Config.ResolvedConfig =>
  testConfig({
    lint: Api.Lint.ResolvedConfig.make({
      defaults: Api.Lint.ResolvedRuleDefaults.make({
        enabled: 'auto',
        severity: 'error',
      }),
      rules: {},
      ...(lint.defaults !== undefined ? { defaults: lint.defaults } : {}),
      ...(lint.rules !== undefined ? { rules: lint.rules } : {}),
      ...(lint.onlyRules !== undefined ? { onlyRules: lint.onlyRules } : {}),
      ...(lint.skipRules !== undefined ? { skipRules: lint.skipRules } : {}),
    }),
  })

describe('command lint rule config', () => {
  test('enables typed command rules while preserving existing severity and merged options', () => {
    const config = makeResolvedConfig({
      rules: {
        'env.publish-channel-ready': Api.Lint.ResolvedRuleConfig.make({
          overrides: Api.Lint.ResolvedRuleDefaults.make({
            enabled: 'auto',
            severity: 'warn',
          }),
          options: {
            surface: 'execution',
          },
        }),
      },
    })

    const lintConfig = createCommandLintConfig({
      config,
      rules: [
        {
          id: 'env.publish-channel-ready',
          options: {
            surface: 'preview',
          },
        },
        {
          id: 'plan.tags-unique',
        },
      ],
    })

    expect(lintConfig.rules['env.publish-channel-ready']).toMatchObject({
      overrides: {
        enabled: true,
        severity: 'warn',
      },
      options: {
        surface: 'preview',
      },
    })
    expect(lintConfig.rules['plan.tags-unique']).toMatchObject({
      overrides: {
        enabled: true,
        severity: 'error',
      },
      options: {},
    })
  })

  test('lets command surfaces override rule filters and severity explicitly', () => {
    const config = makeResolvedConfig({
      onlyRules: ['env.git-clean'],
      skipRules: ['env.npm-authenticated'],
      rules: {
        'pr.projected-squash-commit-sync': Api.Lint.ResolvedRuleConfig.make({
          overrides: Api.Lint.ResolvedRuleDefaults.make({
            enabled: 'auto',
            severity: 'warn',
          }),
          options: {
            projectedHeader: 'fix(core): old header',
          },
        }),
      },
    })

    const lintConfig = createCommandLintConfig({
      config,
      rules: [
        {
          id: 'pr.projected-squash-commit-sync',
          options: {
            projectedHeader: 'feat(core): release',
          },
          severity: 'error',
        },
      ],
      onlyRules: ['pr.projected-squash-commit-sync'],
      skipRules: [],
    })

    expect(lintConfig.onlyRules).toEqual(['pr.projected-squash-commit-sync'])
    expect(lintConfig.skipRules).toEqual([])
    expect(lintConfig.rules['pr.projected-squash-commit-sync']).toMatchObject({
      overrides: {
        enabled: true,
        severity: 'error',
      },
      options: {
        projectedHeader: 'feat(core): release',
      },
    })
  })

  test('can preserve existing overrides while still merging explicit rule options', () => {
    const config = makeResolvedConfig({
      rules: {
        'pr.projected-squash-commit-sync': Api.Lint.ResolvedRuleConfig.make({
          overrides: Api.Lint.ResolvedRuleDefaults.make({
            enabled: false,
            severity: 'error',
          }),
          options: {
            projectedHeader: 'fix(core): old header',
          },
        }),
      },
    })

    const lintConfig = createCommandLintConfig({
      config,
      rules: [
        {
          id: 'pr.projected-squash-commit-sync',
          options: {
            projectedHeader: 'feat(core): release',
          },
          enabled: 'auto',
          severity: 'warn',
          preserveExistingOverrides: true,
        },
      ],
    })

    expect(lintConfig.rules['pr.projected-squash-commit-sync']).toMatchObject({
      overrides: {
        enabled: false,
        severity: 'error',
      },
      options: {
        projectedHeader: 'feat(core): release',
      },
    })
  })
})
