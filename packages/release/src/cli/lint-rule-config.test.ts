import { Pkg } from '@kitz/pkg'
import { describe, expect, test } from 'vitest'
import * as Api from '../api/__.js'
import { createCommandLintConfig } from './lint-rule-config.js'

const makeResolvedConfig = (
  lint: Partial<typeof Api.Lint.ResolvedConfig.Type> = {},
): Api.Config.ResolvedConfig =>
  Api.Config.ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: {},
    publishing: Api.Publishing.defaultPublishing(),
    operator: Api.Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      }),
      releaseCommand: 'bun run release',
      prepareCommands: [],
    }),
    lint: Api.Lint.ResolvedConfig.make({
      defaults: Api.Lint.ResolvedRuleDefaults.make({
        enabled: 'auto',
        severity: Api.Lint.Error.make({}),
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
            severity: Api.Lint.Warn.make({}),
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
        severity: { _tag: 'SeverityWarn' },
      },
      options: {
        surface: 'preview',
      },
    })
    expect(lintConfig.rules['plan.tags-unique']).toMatchObject({
      overrides: {
        enabled: true,
        severity: { _tag: 'SeverityError' },
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
            severity: Api.Lint.Warn.make({}),
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
          severity: Api.Lint.Error.make({}),
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
        severity: { _tag: 'SeverityError' },
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
            severity: Api.Lint.Error.make({}),
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
          severity: Api.Lint.Warn.make({}),
          preserveExistingOverrides: true,
        },
      ],
    })

    expect(lintConfig.rules['pr.projected-squash-commit-sync']).toMatchObject({
      overrides: {
        enabled: false,
        severity: { _tag: 'SeverityError' },
      },
      options: {
        projectedHeader: 'feat(core): release',
      },
    })
  })
})
