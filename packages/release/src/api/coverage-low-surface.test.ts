import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Platform } from '@kitz/platform'
import { Semver } from '@kitz/semver'
import { Effect, FileSystem, Layer, Option, Ref } from 'effect'
import { describe, expect, test } from 'vitest'
import { defineConfig, init as initConfig, load as loadConfig } from './config.js'
import { forecast } from './forecaster/forecast.js'
import { CommitDisplay, ForecastCascade, ForecastRelease } from './forecaster/models.js'
import {
  DefaultPrLayer,
  fromPullRequest,
  PrService,
} from './lint/services/pr.js'
import { MonorepoService } from './lint/services/monorepo.js'
import { DiffService } from './lint/services/diff.js'
import { GitHubService } from './lint/services/github.js'
import { rule as gitHistoryMonotonicRule } from './lint/rules/git-history-monotonic.js'
import { rule as matchAffectedRule } from './lint/rules/pr-monorepo-scopes-match-affected.js'
import { rule as matchKnownRule } from './lint/rules/pr-monorepo-scopes-match-known.js'
import { rule as repoSquashOnlyRule } from './lint/rules/repo-squash-only.js'
import { GitHistory, PrTitle, RepoSettings } from './lint/models/violation-location.js'
import { Warn } from './lint/models/severity.js'
import { Operator as OperatorConfig, resolve as resolveOperator } from './operator.js'
import { make as makePlan, Plan } from './planner/models/plan.js'
import { Analysis } from './analyzer/models/analysis.js'
import { CascadeImpact } from './analyzer/models/cascade-impact.js'
import { makeCascadeCommit, ReleaseCommit } from './analyzer/models/commit.js'
import { Impact } from './analyzer/models/impact.js'
import * as Workspace from './analyzer/workspace.js'

const makePackage = (scope: string, name = `@kitz/${scope}`): Workspace.Package => ({
  scope,
  name: Pkg.Moniker.parse(name),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makeSingleCommit = (
  hash: string,
  scope: string,
  type: 'feat' | 'fix' = 'feat',
  message = 'ship it',
  breaking = false,
): ReleaseCommit =>
  ReleaseCommit.make({
    hash: Git.Sha.make(hash),
    author: Git.Author.make({ name: 'Release Bot', email: 'bot@example.com' }),
    date: new Date('2024-01-01T00:00:00.000Z'),
    message: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.Standard.parse(type),
      scopes: [scope],
      breaking,
      message,
      body: Option.none(),
      footers: [],
    }),
  })

const runRule = <A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)))

describe('release low-surface coverage', () => {
  test('covers config helpers and operator resolution', async () => {
    const layer = Layer.mergeAll(
      Fs.Memory.layer({}),
      Env.Test({
        cwd: Fs.Path.AbsDir.fromString('/repo/'),
        vars: {
          npm_config_user_agent: 'bun/1.3.6 darwin arm64',
        },
      }),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const loaded = yield* loadConfig({
          trunk: 'develop',
          packages: { core: '@kitz/core' },
          operator: OperatorConfig.make({
            releaseScript: 'ship',
            prepareScripts: ['build'],
          }),
          lint: {
            defaults: { severity: Warn.make({}) },
            rules: {
              'repo.squash-only': Warn.make({}),
            },
          },
        })

        const created = yield* initConfig()
        const fs = yield* FileSystem.FileSystem
        const content = yield* fs.readFileString('/repo/release.config.ts')
        const second = yield* initConfig()
        const resolvedOperator = yield* resolveOperator(
          OperatorConfig.make({
            releaseScript: 'ship',
            prepareScripts: ['build', 'test'],
          }),
        )

        return { loaded, created, content, second, resolvedOperator }
      }).pipe(Effect.provide(layer)),
    )

    expect(defineConfig({ trunk: 'release/main' })).toEqual({ trunk: 'release/main' })
    expect(result.loaded.trunk).toBe('develop')
    expect(result.loaded.npmTag).toBe('latest')
    expect(result.loaded.candidateTag).toBe('next')
    expect(result.loaded.skipNpm).toBe(false)
    expect(result.loaded.packages).toEqual({ core: '@kitz/core' })
    expect(result.loaded.operator.releaseCommand).toBe('bun run ship')
    expect(result.loaded.lint.defaults.severity._tag).toBe('SeverityWarn')
    expect(result.loaded.lint.rules['repo.squash-only']?.overrides.severity._tag).toBe(
      'SeverityWarn',
    )
    expect(result.created._tag).toBe('Created')
    expect(result.content).toContain("import { defineConfig } from '@kitz/release'")
    expect(result.content).toContain('export default defineConfig({})')
    expect(result.second._tag).toBe('AlreadyExists')
    expect(result.resolvedOperator.releaseCommand).toBe('bun run ship')
    expect(result.resolvedOperator.prepareCommands).toEqual(['bun run build', 'bun run test'])
  })

  test('covers workspace scanning, mapping, and config package resolution', async () => {
    const rootPath = mkdtempSync(path.join(tmpdir(), 'kitz-release-workspace-'))
    const root = Fs.Path.AbsDir.fromString(`${rootPath}/`)

    try {
      mkdirSync(path.join(rootPath, 'packages/core'), { recursive: true })
      mkdirSync(path.join(rootPath, 'packages/cli'), { recursive: true })
      mkdirSync(path.join(rootPath, 'packages/unnamed'), { recursive: true })

      writeFileSync(
        path.join(rootPath, 'package.json'),
        JSON.stringify(
          {
            name: 'workspace',
            workspaces: ['packages/*'],
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootPath, 'packages/core/package.json'),
        JSON.stringify({ name: '@kitz/core', version: '1.0.0' }, null, 2),
      )
      writeFileSync(
        path.join(rootPath, 'packages/cli/package.json'),
        JSON.stringify({ name: '@kitz/cli', version: '1.0.0' }, null, 2),
      )
      writeFileSync(
        path.join(rootPath, 'packages/unnamed/package.json'),
        JSON.stringify({ name: 'unnamed', version: '1.0.0' }, null, 2),
      )

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const scanned = yield* Workspace.scan
          const mapped = Workspace.toPackageMap(scanned)
          const resolved = yield* Workspace.resolvePackages({
            core: '@kitz/core',
            cli: '@kitz/cli',
          })
          return { scanned, mapped, resolved }
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Platform.FileSystem.layer,
              Env.Test({
                cwd: root,
              }),
            ),
          ),
        ),
      )

      expect(result.scanned.map((pkg) => pkg.scope).sort()).toEqual(['cli', 'core'])
      expect(result.mapped).toEqual({
        cli: '@kitz/cli',
        core: '@kitz/core',
      })
      expect(
        result.resolved.map((pkg) => ({
          scope: pkg.scope,
          name: pkg.name.moniker,
          path: Fs.Path.toString(pkg.path),
        })),
      ).toEqual([
        {
          scope: 'core',
          name: '@kitz/core',
          path: `${rootPath}/packages/core/`,
        },
        {
          scope: 'cli',
          name: '@kitz/cli',
          path: `${rootPath}/packages/cli/`,
        },
      ])
    } finally {
      rmSync(rootPath, { recursive: true, force: true })
    }
  })

  test('covers commit helpers, forecasting, and plan construction', () => {
    const corePackage = makePackage('core')
    const cliPackage = makePackage('cli')
    const singleCommit = makeSingleCommit('abc1234', 'core', 'feat', 'new api')
    const multiCommit = ReleaseCommit.make({
      hash: Git.Sha.make('def5678'),
      author: Git.Author.make({ name: 'Release Bot', email: 'bot@example.com' }),
      date: new Date('2024-01-02T00:00:00.000Z'),
      message: ConventionalCommits.Commit.Multi.make({
        targets: [
          ConventionalCommits.Target.make({
            type: ConventionalCommits.Type.Standard.parse('feat'),
            scope: 'core',
            breaking: true,
          }),
          ConventionalCommits.Target.make({
            type: ConventionalCommits.Type.Standard.parse('fix'),
            scope: 'cli',
            breaking: false,
          }),
        ],
        message: 'multi change',
        summary: Option.none(),
        sections: {},
      }),
    })

    expect(singleCommit.forScope('core')).toEqual({
      hash: Git.Sha.make('abc1234'),
      type: 'feat',
      description: 'new api',
      breaking: false,
    })
    expect(ReleaseCommit.forScope(multiCommit, 'core')).toEqual({
      hash: Git.Sha.make('def5678'),
      type: 'feat',
      description: 'multi change',
      breaking: true,
    })
    expect(ReleaseCommit.forScope(multiCommit, 'docs')).toEqual({
      hash: Git.Sha.make('def5678'),
      type: 'chore',
      description: 'multi change',
      breaking: false,
    })

    const cascadeCommit = makeCascadeCommit('cli', 'cascade release')
    expect(cascadeCommit.hash).toBe(Git.Sha.make('0000000'))
    expect(cascadeCommit.forScope('cli').type).toBe('chore')

    const analysis = Analysis.make({
      impacts: [
        Impact.make({
          package: corePackage,
          bump: 'minor',
          commits: [singleCommit],
          currentVersion: Option.some(Semver.fromString('1.0.0')),
        }),
      ],
      cascades: [
        CascadeImpact.make({
          package: cliPackage,
          triggeredBy: [corePackage],
          currentVersion: Option.none(),
        }),
      ],
      unchanged: [],
      tags: [],
    })

    const result = forecast(analysis, {
      ci: {
        detected: false,
        provider: null,
        prNumber: null,
      },
      github: {
        target: {
          owner: 'org',
          repo: 'repo',
          source: 'git:origin',
        },
        credentials: null,
      },
      npm: {
        authenticated: false,
        username: null,
        registry: 'https://registry.npmjs.org/',
      },
      git: {
        clean: true,
        branch: 'main',
        headSha: 'abc1234',
        remotes: {},
      },
    })

    expect(result.owner).toBe('org')
    expect(result.releases[0]).toMatchObject({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
    })
    expect(result.releases[0]?.commits[0]).toEqual(
      CommitDisplay.make({
        shortSha: 'abc1234',
        subject: 'new api',
        type: 'feat',
        breaking: false,
        commitUrl: 'https://github.com/org/repo/commit/abc1234',
      }),
    )
    expect(result.cascades[0]).toEqual(
      ForecastCascade.make({
        packageName: '@kitz/cli',
        packageScope: 'cli',
        currentVersion: Option.none(),
        nextOfficialVersion: Semver.fromString('0.0.1'),
        triggeredBy: ['@kitz/core'],
        sourceUrl: 'https://github.com/org/repo/tree/main/packages/cli',
      }),
    )

    const plan = makePlan('official', [], [])

    expect(plan.lifecycle).toBe('official')
    expect(plan.releases).toHaveLength(0)
    expect(typeof plan.timestamp).toBe('string')
    expect(Plan.empty.lifecycle).toBe('official')
    expect(Plan.empty.releases).toEqual([])
  })

  test('covers PR parsing and PR-based lint rules', async () => {
    const validPr = await Effect.runPromise(
      fromPullRequest({
        number: 7,
        title: 'feat(core): add feature',
        body: null,
      }),
    )
    const invalidPr = await Effect.runPromise(
      fromPullRequest({
        number: 8,
        title: 'not a conventional commit',
        body: 'Body',
      }),
    )
    const defaultPr = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* PrService
      }).pipe(Effect.provide(DefaultPrLayer)),
    )

    expect(Option.isSome(validPr.commit)).toBe(true)
    expect(validPr.body).toBe('')
    expect(Option.isSome(invalidPr.titleParseError)).toBe(true)
    expect(defaultPr.number).toBe(0)

    const knownValid = await runRule(
      matchKnownRule.check,
      Layer.mergeAll(
        Layer.succeed(PrService, validPr),
        Layer.succeed(MonorepoService, {
          packages: [],
          validScopes: ['core', 'cli'],
        }),
      ),
    )
    expect(knownValid).toBeUndefined()

    const knownInvalid = await runRule(
      matchKnownRule.check,
      Layer.mergeAll(
        Layer.succeed(
          PrService,
          await Effect.runPromise(
            fromPullRequest({
              number: 9,
              title: 'feat(unknown): add feature',
              body: null,
            }),
          ),
        ),
        Layer.succeed(MonorepoService, {
          packages: [],
          validScopes: ['core'],
        }),
      ),
    )
    expect(knownInvalid && PrTitle.is(knownInvalid.location)).toBe(true)

    const affectedInvalid = await runRule(
      matchAffectedRule.check,
      Layer.mergeAll(
        Layer.succeed(PrService, validPr),
        Layer.succeed(DiffService, {
          files: [],
          affectedPackages: ['cli'],
        }),
      ),
    )
    expect(affectedInvalid && PrTitle.is(affectedInvalid.location)).toBe(true)
  })

  test('covers repository and monotonic-history lint rules', async () => {
    const squashValid = await runRule(
      repoSquashOnlyRule.check,
      Layer.succeed(GitHubService, {
        settings: {
          allowSquashMerge: true,
          allowMergeCommit: false,
          allowRebaseMerge: false,
        },
      }),
    )
    expect(squashValid).toBeUndefined()

    const squashInvalid = await runRule(
      repoSquashOnlyRule.check,
      Layer.succeed(GitHubService, {
        settings: {
          allowSquashMerge: true,
          allowMergeCommit: true,
          allowRebaseMerge: false,
        },
      }),
    )
    expect(squashInvalid && RepoSettings.is(squashInvalid.location)).toBe(true)

    const monotonicViolation = await Effect.runPromise(
      Effect.gen(function* () {
        const { layer, state } = yield* Git.Memory.makeWithState({
          tags: ['@kitz/core@2.0.0', '@kitz/core@1.0.0'],
        })

        yield* Ref.set(state.tagShas, {
          '@kitz/core@2.0.0': Git.Sha.make('aaa1111'),
          '@kitz/core@1.0.0': Git.Sha.make('bbb2222'),
        })
        yield* Ref.set(state.commitParents, {
          bbb2222: ['aaa1111'],
        })

        return yield* gitHistoryMonotonicRule.check.pipe(Effect.provide(layer))
      }),
    )

    expect(monotonicViolation && GitHistory.is(monotonicViolation.location)).toBe(true)
  })
})
