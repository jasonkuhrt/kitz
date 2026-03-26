import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import * as PlatformError from 'effect/PlatformError'
import { Sink, Stream, Effect, Layer, Option } from 'effect'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'vitest'
import * as Api from '../api/__.js'
import { Analysis } from '../api/analyzer/models/analysis.js'
import { Impact } from '../api/analyzer/models/impact.js'
import { Forecast } from '../api/forecaster/models.js'
import { Finished, Report } from '../api/lint/models/report.js'
import { RuleId } from '../api/lint/models/rule-defaults.js'
import * as Severity from '../api/lint/models/severity.js'
import { Ephemeral as PlannerEphemeral } from '../api/planner/models/item-ephemeral.js'
import { makeHarness, makePackageJson } from '../api/executor/test-support.js'
import { loadPullRequestDiff } from './pr-preview-diff.js'
import {
  type PreviewCommentUpdateParams,
  PreviewBlockingError,
  buildPreviewDoctorSummary,
  runPrPreview,
} from './pr-preview.js'

const textEncoder = new TextEncoder()

const makePackage = (scope: string) => ({
  scope,
  name: Pkg.Moniker.parse(`@kitz/${scope}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const corePackage = makePackage('core')
const utilsPackage = makePackage('utils')

const makeConfig = (
  publishing: Api.Config.ResolvedConfig['publishing'] = Api.Publishing.defaultPublishing(),
) =>
  Api.Config.ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: { core: '@kitz/core' },
    publishing,
    operator: Api.Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      }),
      releaseCommand: 'bun run release',
      prepareCommands: ['bun run release:build'],
    }),
    lint: Api.Lint.resolveConfig({
      defaults: Api.Lint.RuleDefaults.make({
        enabled: 'auto',
        severity: Severity.Warn.make({}),
      }),
    }),
  })

const makeRuntime = (
  overrides?: Partial<{
    target: Api.Explorer.GitIdentity | null
    credentials: Api.Explorer.GithubCredentials | null
  }>,
) =>
  ({
    ci: { detected: false, provider: null, prNumber: null },
    github: {
      target:
        overrides && 'target' in overrides
          ? (overrides.target ?? null)
          : {
              owner: 'org',
              repo: 'repo',
              source: 'env:GITHUB_REPOSITORY' as const,
            },
      credentials:
        overrides && 'credentials' in overrides
          ? (overrides.credentials ?? null)
          : {
              token: 'token-123',
              source: 'env:GITHUB_TOKEN' as const,
            },
    },
    npm: {
      authenticated: false,
      username: null,
      registry: 'https://registry.npmjs.org',
    },
    git: {
      root: Fs.Path.AbsDir.fromString('/repo/'),
      clean: true,
      branch: 'feature/release',
      headSha: 'abc1234',
      remotes: {},
    },
  }) as Api.Explorer.Recon

const pullRequest = {
  number: 129,
  html_url: 'https://github.com/org/repo/pull/129',
  title: 'feat(core): release',
  body: 'body',
  base: { ref: 'main' },
  head: { ref: 'feature/release' },
} satisfies Github.PullRequest

const makeAnalysis = (impacts: Analysis['impacts'] = []) =>
  Analysis.make({
    impacts,
    cascades: [],
    unchanged: [],
    tags: [],
  })

const baseForecast = Forecast.make({
  owner: 'org',
  repo: 'repo',
  branch: 'feature/release',
  headSha: 'abc1234',
  releases: [],
  cascades: [],
})

const makeHandle = (stdout: string): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    all: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  })

const makeDiffSpawnerLayer = (
  result:
    | { readonly stdout: string }
    | {
        readonly failure: Error
      },
) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      const standard = ChildProcess.isStandardCommand(command) ? command : undefined
      if (!standard) {
        return Effect.die('Unexpected piped command in diff spawner test')
      }

      if ('failure' in result) {
        return Effect.fail(
          new PlatformError.SystemError({
            _tag: 'Unknown',
            module: 'ChildProcess',
            method: 'spawn',
          }),
        ) as any
      }

      return Effect.succeed(makeHandle(result.stdout))
    }),
  )

const ruleRef = (id: string, description: string) => ({
  id: RuleId.makeUnsafe(id),
  description,
})

const makePullRequestContext = (
  overrides?: Partial<Api.Explorer.ResolvedPullRequestContext>,
): Api.Explorer.ResolvedPullRequestContext => ({
  branch: 'feature/release',
  explicitPrNumber: null,
  target: {
    owner: 'org',
    repo: 'repo',
    source: 'env:GITHUB_REPOSITORY',
  },
  token: 'token-123',
  pullRequest,
  ...overrides,
})

const getFailureDetail = (error: unknown): string => {
  if (typeof error !== 'object' || error === null || !('context' in error)) return ''
  const context = error.context
  if (typeof context !== 'object' || context === null || !('detail' in context)) return ''
  return typeof context.detail === 'string' ? context.detail : ''
}

const assumePure = <A, E>(effect: Effect.Effect<A, E, unknown>) =>
  effect as Effect.Effect<A, E, never>

describe('pr preview coverage', () => {
  test('returns null for optional diff checks when the pull request base ref is missing', async () => {
    const result = await Effect.runPromise(
      loadPullRequestDiff({
        pullRequest: {
          ...pullRequest,
          base: { ref: '   ' },
        },
        packages: [corePackage],
        required: false,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Git.Memory.make({ root: '/repo' }), makeDiffSpawnerLayer({ stdout: '' })),
        ),
      ),
    )

    expect(result).toBeNull()
  })

  test('parses git diff output into changed files and affected package scopes', async () => {
    const result = await Effect.runPromise(
      loadPullRequestDiff({
        pullRequest,
        packages: [corePackage, utilsPackage],
        required: true,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Git.Memory.make({ root: '/repo' }),
            makeDiffSpawnerLayer({
              stdout: [
                'M\tpackages/core/src/index.ts',
                'R100\tpackages/core/src/old.ts\tpackages/utils/src/index.ts',
                'A\tREADME.md',
              ].join('\n'),
            }),
          ),
        ),
      ),
    )

    expect(result).toEqual({
      files: [
        { path: 'packages/core/src/index.ts', status: 'modified' },
        { path: 'packages/utils/src/index.ts', status: 'renamed' },
        { path: 'README.md', status: 'added' },
      ],
      affectedPackages: ['core', 'utils'],
    })
  })

  test('degrades optional diff checks to an empty diff when git diff cannot run', async () => {
    const result = await Effect.runPromise(
      loadPullRequestDiff({
        pullRequest,
        packages: [corePackage],
        required: false,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Git.Memory.make({ root: '/repo' }),
            makeDiffSpawnerLayer({
              failure: new Error('diff exploded'),
            }),
          ),
        ),
      ),
    )

    expect(result).toEqual({
      files: [],
      affectedPackages: [],
    })
  })

  test('fails required diff checks when git diff cannot run', async () => {
    const result = await Effect.runPromise(
      loadPullRequestDiff({
        pullRequest,
        packages: [corePackage],
        required: true,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Git.Memory.make({ root: '/repo' }),
            makeDiffSpawnerLayer({
              failure: new Error('diff exploded'),
            }),
          ),
        ),
        Effect.result,
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected diff loading to fail')
    }

    expect(result.failure.context.detail).toContain(
      'Could not compute git diff against origin/main',
    )
  })

  test('returns a warning summary when ephemeral planning fails', async () => {
    const result = await Effect.runPromise(
      assumePure(
        buildPreviewDoctorSummary(
          {
            config: makeConfig(),
            analysis: makeAnalysis(),
            packages: [corePackage],
            pullRequest,
            diff: { files: [], affectedPackages: [] },
            blockingTitleChecks: true,
          },
          {
            planEphemeral: () => Effect.fail(new Error('ephemeral planning failed')),
          },
        ),
      ),
    )

    expect(result.blocking).toBe(false)
    expect(result.summary?.rows).toEqual([
      {
        label: 'Ephemeral plan',
        status: 'warn',
        notes: 'ephemeral planning failed',
      },
    ])
  })

  test('returns no doctor summary when the ephemeral plan is empty', async () => {
    const result = await Effect.runPromise(
      assumePure(
        buildPreviewDoctorSummary(
          {
            config: makeConfig(),
            analysis: makeAnalysis(),
            packages: [corePackage],
            pullRequest,
            diff: { files: [], affectedPackages: [] },
            blockingTitleChecks: true,
          },
          {
            planEphemeral: () =>
              Effect.succeed({
                lifecycle: 'ephemeral' as const,
                releases: [],
                cascades: [],
              } as any),
          },
        ),
      ),
    )

    expect(result).toEqual({ blocking: false })
  })

  test('builds manual preview runbooks and deferred checks from injected planning and lint results', async () => {
    let captured: { config: Api.Lint.ResolvedConfig } | undefined
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: {
            status: 'manual',
            mode: 'manual',
          },
        }),
      ],
    })

    const result = await Effect.runPromise(
      assumePure(
        buildPreviewDoctorSummary(
          {
            config: makeConfig(
              Api.Publishing.Publishing.make({
                official: { mode: 'manual' },
                candidate: { mode: 'manual' },
                ephemeral: { mode: 'manual' },
              }),
            ),
            analysis: makeAnalysis(),
            packages: [corePackage],
            pullRequest,
            projectedSquashCommit: {
              actualTitle: pullRequest.title,
              actualHeader: 'feat(core): release',
              actualTitleError: null,
              projectedHeader: 'feat(core): projected release header',
              inSync: false,
              reason: null,
            },
            diff: { files: [], affectedPackages: [] },
            blockingTitleChecks: false,
          },
          {
            planEphemeral: () =>
              Effect.succeed({
                lifecycle: 'ephemeral' as const,
                releases: [
                  PlannerEphemeral.make({
                    package: corePackage,
                    commits: [],
                    prerelease: Api.Version.Ephemeral.make({
                      prNumber: 42,
                      iteration: 1,
                      sha: Git.Sha.make('abc1234'),
                    }),
                  }),
                ],
                cascades: [],
              } as any),
            runLintCheck: (params) => {
              captured = params
              return Effect.succeed(report)
            },
          },
        ),
      ),
    )

    expect(result.blocking).toBe(false)
    expect(result.summary?.runbook?.commands).toEqual([
      'bun run release:build',
      'PR_NUMBER=42 bun run release plan --lifecycle ephemeral',
      'bun run release doctor',
      'bun run release apply --yes',
    ])
    expect(result.summary?.deferredChecks.map((check) => check.ruleId)).toContain(
      'env.npm-authenticated',
    )
    expect(captured?.config.onlyRules).toContain('pr.projected-squash-commit-sync')
    expect(captured?.config.rules['pr.type.release-kind-match-diff']?.overrides.severity._tag).toBe(
      'SeverityWarn',
    )
  })

  test('can execute live preview lint wiring against the harness services', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: {
          tags: [],
          commits: [],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
            private: false,
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
      buildPreviewDoctorSummary(
        {
          config: makeConfig(
            Api.Publishing.Publishing.make({
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: { mode: 'manual' },
            }),
          ),
          analysis: makeAnalysis(),
          packages: [corePackage],
          pullRequest,
          diff: {
            files: [{ path: 'packages/core/src/index.ts', status: 'modified' }],
            affectedPackages: ['core'],
          },
          blockingTitleChecks: true,
        },
        {
          planEphemeral: () =>
            Effect.succeed({
              lifecycle: 'ephemeral' as const,
              releases: [
                PlannerEphemeral.make({
                  package: corePackage,
                  commits: [],
                  prerelease: Api.Version.Ephemeral.make({
                    prNumber: 129,
                    iteration: 1,
                    sha: Git.Sha.make('abc1234'),
                  }),
                }),
              ],
              cascades: [],
            } as any),
        },
      ).pipe(Effect.provide(harness.workflowLayer)),
    )

    expect(result.summary?.rows.length).toBeGreaterThan(0)
  })

  test('fails early when no releasable packages are resolved', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          {},
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([]),
          },
        ).pipe(Effect.result),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview to fail')
    }

    expect(getFailureDetail(result.failure)).toContain('No packages found')
  })

  test('fails when pull-request context resolution fails', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          {},
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () =>
              Effect.fail(
                new Api.Explorer.ExplorerError({
                  context: {
                    detail: 'context exploded',
                  },
                }),
              ),
          },
        ).pipe(Effect.result),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview to fail')
    }

    expect(getFailureDetail(result.failure)).toContain('context exploded')
  })

  test('fails when no open pull request can be resolved for the branch', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          {},
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () =>
              Effect.succeed(makePullRequestContext({ pullRequest: null })),
            exploreFromContext: () => Effect.succeed(makeRuntime()),
          },
        ).pipe(Effect.result),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview to fail')
    }

    expect(getFailureDetail(result.failure)).toContain('Could not resolve an open pull request')
  })

  test('fails when the runtime does not provide a GitHub token', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          {},
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () =>
              Effect.succeed(makePullRequestContext({ token: null })),
            exploreFromContext: () =>
              Effect.succeed(
                makeRuntime({
                  credentials: null,
                }),
              ),
          },
        ).pipe(Effect.result),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview to fail')
    }

    expect(result.failure).toBeInstanceOf(Github.GithubConfigError)
  })

  test('raises a blocking error in check-only mode when doctor checks fail', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          { checkOnly: true },
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () => Effect.succeed(makePullRequestContext()),
            exploreFromContext: () => Effect.succeed(makeRuntime()),
            getTags: () => Effect.succeed([]),
            analyze: () => Effect.succeed(makeAnalysis()),
            loadPullRequestDiff: () => Effect.succeed({ files: [], affectedPackages: [] }),
            buildPreviewDoctorSummary: () => Effect.succeed({ blocking: true }),
          },
        ).pipe(Effect.result),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview to fail')
    }

    expect(result.failure).toBeInstanceOf(PreviewBlockingError)
  })

  test('returns a checked result in check-only mode when doctor checks pass', async () => {
    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          { checkOnly: true },
          {
            loadConfig: () => Effect.succeed(makeConfig()),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () => Effect.succeed(makePullRequestContext()),
            exploreFromContext: () => Effect.succeed(makeRuntime()),
            getTags: () => Effect.succeed([]),
            analyze: () => Effect.succeed(makeAnalysis()),
            loadPullRequestDiff: () => Effect.succeed({ files: [], affectedPackages: [] }),
            buildPreviewDoctorSummary: () => Effect.succeed({ blocking: false }),
          },
        ),
      ),
    )

    expect(result).toEqual({
      _tag: 'checked',
      issueNumber: 129,
    })
  })

  test('updates the preview comment with injected transport dependencies', async () => {
    const analysis = makeAnalysis([
      Impact.make({
        package: corePackage,
        bump: 'minor',
        commits: [],
        currentVersion: Option.some(Semver.fromString('1.0.0')),
      }),
    ])
    let capturedUpdate: PreviewCommentUpdateParams | undefined

    const result = await Effect.runPromise(
      assumePure(
        runPrPreview(
          {},
          {
            loadConfig: () =>
              Effect.succeed(
                makeConfig(
                  Api.Publishing.Publishing.make({
                    official: { mode: 'manual' },
                    candidate: { mode: 'manual' },
                    ephemeral: {
                      mode: 'github-token',
                      workflow: 'preview.yml',
                      tokenEnv: 'NPM_TOKEN',
                    },
                  }),
                ),
              ),
            resolvePackages: () => Effect.succeed([corePackage]),
            resolvePullRequestContext: () => Effect.succeed(makePullRequestContext()),
            exploreFromContext: () => Effect.succeed(makeRuntime()),
            getTags: () => Effect.succeed([]),
            analyze: () => Effect.succeed(analysis),
            loadPullRequestDiff: () =>
              Effect.succeed({
                files: [{ path: 'packages/core/src/index.ts', status: 'modified' }],
                affectedPackages: ['core'],
              }),
            buildPreviewDoctorSummary: () =>
              Effect.succeed({
                blocking: false,
                summary: {
                  lifecycle: 'ephemeral',
                  rows: [
                    {
                      label: 'Publish channel',
                      status: 'pass',
                      notes: 'Publish channel is ready.',
                    },
                  ],
                  guidance: [],
                  deferredChecks: [],
                },
              }),
            forecast: () => baseForecast,
            upsertPullRequestPreviewComment: (params: PreviewCommentUpdateParams) => {
              capturedUpdate = params
              return Effect.succeed({
                body: 'rendered preview',
                issueComment: {
                  id: 41,
                  body: 'rendered preview',
                  html_url: 'https://github.com/org/repo/pull/129#issuecomment-41',
                },
              })
            },
          },
        ),
      ),
    )

    expect(result).toEqual({
      _tag: 'updated',
      body: 'rendered preview',
      issueComment: {
        id: 41,
        body: 'rendered preview',
        html_url: 'https://github.com/org/repo/pull/129#issuecomment-41',
      },
    })
    expect(capturedUpdate?.interactiveChecklist).toBe(true)
    expect(capturedUpdate?.projectedSquashCommit?.projectedHeader).toContain('feat(core)')
  })
})
