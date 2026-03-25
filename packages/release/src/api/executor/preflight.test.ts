import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Finished, Report } from '../lint/models/report.js'
import { RuleId } from '../lint/models/rule-defaults.js'
import * as Severity from '../lint/models/severity.js'
import { Violation } from '../lint/models/violation.js'
import { File } from '../lint/models/violation-location.js'
import { PreflightError, run } from './preflight.js'
import { makeHarness, makePackageJson } from './test-support.js'

describe('PreflightError', () => {
  test('constructs with check and detail', () => {
    const err = new PreflightError({
      context: {
        check: 'env.npm-authenticated',
        detail: 'Not logged in to npm registry',
      },
    })
    expect(err._tag).toBe('PreflightError')
    expect(err.message).toContain('env.npm-authenticated')
    expect(err.message).toContain('Not logged in')
    expect(err.message).toContain('release doctor')
  })

  test('is an Error instance', () => {
    const err = new PreflightError({
      context: { check: 'env.git-clean', detail: 'dirty working dir' },
    })
    expect(err).toBeInstanceOf(Error)
  })

  test('message includes doctor investigation suggestion', () => {
    const err = new PreflightError({
      context: { check: 'plan.tags-unique', detail: 'tag exists' },
    })
    expect(err.message).toContain('--onlyRule')
    expect(err.message).toContain('plan.tags-unique')
  })
})

describe('preflight.run', () => {
  const ruleRef = (id: string, description: string) => ({
    id: RuleId.makeUnsafe(id),
    description,
  })

  const release = {
    package: {
      name: Pkg.Moniker.parse('@kitz/core'),
      scope: 'core',
      path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
    },
    nextVersion: Semver.fromString('1.1.0'),
  }

  test('returns npm and git metadata when all checks pass', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: {
          tags: ['@kitz/core@1.0.0'],
          commits: [],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
            license: 'MIT',
            repository: {
              type: 'git',
              url: 'git+https://github.com/jasonkuhrt/kitz.git',
            },
          }),
        },
      }),
    )

    const result = await Effect.runPromise(
      run([release], {
        registry: 'https://registry.npmjs.org',
        remote: 'origin',
      }).pipe(Effect.provide(harness.workflowLayer)),
    )

    expect(result).toEqual({
      npmUser: 'mock-user',
      gitRemote: 'git@github.com:example/repo.git',
    })
  })

  test('skips npm auth when github-trusted publishing is active', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: {
          tags: ['@kitz/core@1.0.0'],
          commits: [],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
            license: 'MIT',
            repository: {
              type: 'git',
              url: 'git+https://github.com/jasonkuhrt/kitz.git',
            },
          }),
        },
      }),
    )

    const result = await Effect.runPromise(
      run([release], {
        lifecycle: 'official',
        publishing: {
          official: { mode: 'github-trusted', workflow: 'trunk.yml' },
          candidate: { mode: 'manual' },
          ephemeral: { mode: 'manual' },
        },
      }).pipe(Effect.provide(harness.workflowLayer)),
    )

    expect(result.npmUser).toBe('(unknown)')
    expect(result.gitRemote).toBe('git@github.com:example/repo.git')
  })

  test('maps current-branch failures to env.release-branch-allowed', async () => {
    const result = await Effect.runPromise(
      run([release], undefined, {
        getCurrentBranch: () => Effect.fail(new Error('branch unavailable')),
      }).pipe(Effect.provide(Git.Memory.make({})), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preflight to fail')
    }

    expect(result.failure.context.check).toBe('env.release-branch-allowed')
    expect(result.failure.context.detail).toContain('branch unavailable')
  })

  test('maps lint execution failures to lint-execution', async () => {
    const result = await Effect.runPromise(
      run([release], undefined, {
        runLintCheck: () => Effect.fail(new Error('lint exploded')),
      }).pipe(Effect.provide(Git.Memory.make({})), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preflight to fail')
    }

    expect(result.failure.context.check).toBe('lint-execution')
    expect(result.failure.context.detail).toContain('lint exploded')
  })

  test('falls back when metadata is malformed and uses a generic message for non-environment violations', async () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef('env.npm-authenticated', 'npm auth is configured'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: { account: 'mock-user' },
        }),
        Finished.make({
          rule: ruleRef('env.git-remote', 'git remote is configured and reachable'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: { href: 'git@github.com:example/repo.git' },
        }),
        Finished.make({
          rule: ruleRef('plan.versions-unpublished', 'planned versions are not already published'),
          duration: 1,
          severity: Severity.Error.make({}),
          violation: Violation.make({
            location: File.make({ path: 'packages/core/package.json' }),
            summary: 'Version already exists.',
          }),
        }),
      ],
    })

    const result = await Effect.runPromise(
      run([release], undefined, {
        runLintCheck: () => Effect.succeed(report),
      }).pipe(Effect.provide(Git.Memory.make({})), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preflight to fail')
    }

    expect(result.failure.context.check).toBe('plan.versions-unpublished')
    expect(result.failure.context.detail).toBe('Check failed')
  })
})
