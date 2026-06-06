import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import { makeHarness, makePackageJson } from '../../executor/test-support.js'
import * as Operator from '../../operator.js'
import { defaultPublishing } from '../../publishing.js'
import {
  ResolvedConfig as ReleaseResolvedConfig,
  resolveConventionalCommitTypes,
} from '../../config.js'
import { Error as SeverityError, Warn as SeverityWarn } from '../models/severity.js'
import { resolveConfig } from '../models/config.js'
import { Finished } from '../models/report.js'
import { createCommandLintConfig } from './command-lint-rule.js'
import { checkForPreview, previewDoctorRules } from './preview.js'

namespace Fx {
  export const releaseConfig = ReleaseResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: { core: '@kitz/core' },
    publishing: defaultPublishing(),
    operator: Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({ name: 'bun', source: 'runtime' }),
      releaseCommand: 'bun run release',
      prepareCommands: [],
    }),
    resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
    commitOverrides: {},
    lint: resolveConfig({}),
  })
}

describe('previewDoctorRules', () => {
  test('returns the preview doctor rule set in order without a projected header', () => {
    const rules = previewDoctorRules({ titleSeverity: SeverityWarn.make({}) })

    expect(rules.map((rule) => rule.id)).toEqual([
      'env.publish-channel-ready',
      'plan.packages-not-private',
      'plan.packages-license-present',
      'plan.packages-repository-present',
      'plan.packages-repository-match-canonical',
      'plan.versions-unpublished',
      'plan.tags-unique',
      'pr.type.release-kind-match-diff',
    ])
  })

  test('appends the conditional projected-squash-commit-sync rule when a header is present', () => {
    const rules = previewDoctorRules({
      projectedHeader: 'feat(core): release',
      titleSeverity: SeverityError.make({}),
    })

    expect(rules.map((rule) => rule.id)).toEqual([
      'env.publish-channel-ready',
      'plan.packages-not-private',
      'plan.packages-license-present',
      'plan.packages-repository-present',
      'plan.packages-repository-match-canonical',
      'plan.versions-unpublished',
      'plan.tags-unique',
      'pr.type.release-kind-match-diff',
      'pr.projected-squash-commit-sync',
    ])
  })

  test('applies titleSeverity to the title-dependent rules only', () => {
    const rules = previewDoctorRules({
      projectedHeader: 'feat(core): release',
      titleSeverity: SeverityError.make({}),
    })

    const ruleById = (id: string) => rules.find((rule) => rule.id === id)
    expect(ruleById('pr.type.release-kind-match-diff')?.severity?._tag).toBe('SeverityError')
    expect(ruleById('pr.projected-squash-commit-sync')?.severity?._tag).toBe('SeverityError')
    expect(ruleById('plan.tags-unique')?.severity).toBeUndefined()
  })
})

describe('checkForPreview', () => {
  test('produces a lint Report by wiring the preview services around check', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: { tags: [], commits: [], isClean: true },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
            private: false,
            license: 'MIT',
            repository: { type: 'git', url: 'git+https://github.com/jasonkuhrt/kitz.git' },
          }),
        },
      }),
    )

    const rules = previewDoctorRules({ titleSeverity: SeverityWarn.make({}) })
    const config = createCommandLintConfig({
      config: Fx.releaseConfig,
      rules,
      onlyRules: rules.map((rule) => rule.id),
      skipRules: [],
    })

    const report = await Effect.runPromise(
      checkForPreview({
        config,
        diff: {
          files: [{ path: 'packages/core/src/index.ts', status: 'modified' }],
          affectedPackages: ['core'],
        },
        packageCount: 1,
        monorepo: {
          packages: [{ name: '@kitz/core', path: 'packages/core/' }],
          validScopes: ['core'],
        },
        releasePlan: [
          {
            packageName: Pkg.Moniker.parse('@kitz/core'),
            packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
            version: Semver.fromString('1.1.0'),
          },
        ],
        lifecycle: 'ephemeral',
        publishing: defaultPublishing(),
        resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
        pullRequest: { number: 42, title: 'feat(core): release', body: '' },
      }).pipe(Effect.provide(harness.workflowLayer)),
    )

    const tagsUnique = report.results.find((entry) => entry.rule.id === 'plan.tags-unique')
    expect(tagsUnique).toBeDefined()
    expect(tagsUnique && Finished.is(tagsUnique)).toBe(true)
  })
})
