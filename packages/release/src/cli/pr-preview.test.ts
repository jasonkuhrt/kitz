import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Github } from '@kitz/github'
import { Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Api from '../api/__.js'
import { Analysis, Impact, makeCascadeCommit } from '../api/analyzer/models/__.js'
import { makeMockSpawnerLayer } from '../api/executor/test-support.js'
import { CommitDisplay, Forecast, ForecastRelease } from '../api/forecaster/models.js'
import { FileSystemLayer } from '../platform.js'
import {
  PreviewBlockingError,
  buildPreviewDoctorSummary,
  upsertPullRequestPreviewComment,
} from './pr-preview.js'

const forecast = Forecast.make({
  owner: 'org',
  repo: 'repo',
  branch: 'main',
  headSha: 'abc1234',
  releases: [
    ForecastRelease.make({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      currentVersion: Option.some(Semver.fromString('1.0.0')),
      nextOfficialVersion: Semver.fromString('1.1.0'),
      commits: [
        CommitDisplay.make({
          shortSha: 'abc1234',
          subject: 'new api',
          type: 'feat',
          breaking: false,
          commitUrl: 'https://github.com/org/repo/commit/abc1234',
        }),
      ],
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
    }),
  ],
  cascades: [],
})

const passDoctor = {
  lifecycle: 'ephemeral' as const,
  rows: [
    {
      label: 'Release header',
      status: 'pass' as const,
      notes: 'PR title already matches the canonical release header.',
    },
  ],
  guidance: [],
  deferredChecks: [],
} satisfies Api.Commentator.DoctorSummary

const blockingDoctor = {
  lifecycle: 'ephemeral' as const,
  rows: [
    {
      label: 'Release kind',
      status: 'error' as const,
      notes:
        'PR title uses a no-release kind, but src changes require a release-triggering header.',
    },
  ],
  guidance: [],
  deferredChecks: [],
} satisfies Api.Commentator.DoctorSummary

const makeResolvedConfig = (): Api.Config.ResolvedConfig =>
  Api.Config.ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: {
      core: '@kitz/core',
    },
    publishing: Api.Publishing.defaultPublishing(),
    operator: Api.Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      }),
      releaseCommand: 'bun run release',
      prepareCommands: ['bun run release:build'],
    }),
    lint: Api.Lint.resolveConfig({}),
  })

describe('pr preview comment sync', () => {
  test('creates a new marker comment when none exists', async () => {
    const { layer, state } = await Effect.runPromise(Github.Memory.makeWithState({}))

    const result = await Effect.runPromise(
      upsertPullRequestPreviewComment({
        issueNumber: 129,
        forecast,
        doctor: passDoctor,
        interactiveChecklist: false,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.body).toContain(Api.Commentator.PLAN_MARKER)
    expect(result.issueComment.body).toContain('## Release Forecast')

    const created = await Effect.runPromise(Ref.get(state.createdIssueComments))
    expect(created).toEqual([
      {
        issueNumber: 129,
        body: result.body,
      },
    ])
  })

  test('updates the existing marker comment and preserves publish history', async () => {
    const existingBody = [
      Api.Commentator.renderMetadataBlock({
        headSha: 'oldsha',
        publishState: 'published',
        publishHistory: [
          {
            package: '@kitz/core',
            version: '0.0.0-pr.129.2.gabc1234',
            iteration: 2,
            sha: 'abc1234',
            timestamp: '2026-03-08T00:00:00.000Z',
            runId: '42',
          },
        ],
      }),
      'old body',
    ].join('\n\n')

    const { layer, state } = await Effect.runPromise(
      Github.Memory.makeWithState({
        issueComments: [
          {
            issueNumber: 129,
            comment: {
              id: 41,
              body: existingBody,
              html_url: 'https://github.com/org/repo/pull/129#issuecomment-41',
              user: { type: 'Bot' },
            },
          },
        ],
      }),
    )

    const result = await Effect.runPromise(
      upsertPullRequestPreviewComment({
        issueNumber: 129,
        forecast,
        doctor: passDoctor,
        interactiveChecklist: false,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.issueComment.id).toBe(41)
    expect(Api.Commentator.parsePublishHistory(result.body)).toEqual([
      {
        package: '@kitz/core',
        version: '0.0.0-pr.129.2.gabc1234',
        iteration: 2,
        sha: 'abc1234',
        timestamp: '2026-03-08T00:00:00.000Z',
        runId: '42',
      },
    ])

    const updated = await Effect.runPromise(Ref.get(state.updatedIssueComments))
    expect(updated).toEqual([
      {
        commentId: 41,
        params: { body: result.body },
      },
    ])
  })

  test('fails after writing the comment when blocking preview issues remain', async () => {
    const { layer, state } = await Effect.runPromise(Github.Memory.makeWithState({}))

    const result = await Effect.runPromise(
      upsertPullRequestPreviewComment({
        issueNumber: 129,
        forecast,
        doctor: blockingDoctor,
        interactiveChecklist: false,
      }).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected preview update to fail')
    }

    expect(result.failure).toBeInstanceOf(PreviewBlockingError)

    const created = await Effect.runPromise(Ref.get(state.createdIssueComments))
    expect(created).toHaveLength(1)
    expect(created[0]?.body).toContain('## Release Forecast')
  })

  test('builds a manual preview runbook that uses the derived per-PR dist-tag automatically', async () => {
    const pullRequest = {
      number: 129,
      html_url: 'https://github.com/org/repo/pull/129',
      title: 'feat(core): release preview',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/release-preview' },
    } satisfies Github.PullRequest

    const packages = [
      {
        scope: 'core',
        name: Pkg.Moniker.parse('@kitz/core'),
        path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
      },
    ] satisfies readonly Api.Analyzer.Workspace.Package[]

    const analysis = Analysis.make({
      impacts: [
        Impact.make({
          package: packages[0]!,
          bump: 'minor',
          commits: [makeCascadeCommit('core', 'preview release')],
          currentVersion: Option.some(Semver.fromString('1.0.0')),
        }),
      ],
      cascades: [],
      unchanged: [],
      tags: ['@kitz/core@1.0.0'],
    })
    const { layer: gitLayer } = await Effect.runPromise(
      Git.Memory.makeWithState({
        root: '/repo',
        branch: 'feature/release-preview',
        headSha: Git.Sha.make('abc1234'),
        tags: ['@kitz/core@1.0.0'],
      }),
    )

    const summary = await Effect.runPromise(
      buildPreviewDoctorSummary({
        config: makeResolvedConfig(),
        analysis,
        packages,
        pullRequest,
        diff: {
          files: [{ path: 'packages/core/src/index.ts', status: 'modified' }],
          affectedPackages: ['@kitz/core'],
        },
        blockingTitleChecks: false,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            FileSystemLayer,
            gitLayer,
            makeMockSpawnerLayer('mock-user'),
            Env.Test({
              cwd: Fs.Path.AbsDir.fromString('/repo/'),
              vars: { PR_NUMBER: '129' },
            }),
            Fs.Memory.layer({
              '/repo/packages/core/package.json': JSON.stringify({
                name: '@kitz/core',
                version: '1.0.0',
              }),
            }),
          ),
        ),
      ),
    )

    expect(summary.summary?.runbook?.commands).toEqual([
      'bun run release:build',
      'PR_NUMBER=129 bun run release plan --lifecycle ephemeral',
      'bun run release doctor',
      'bun run release apply --yes',
    ])
    expect(summary.summary?.runbook?.note).toContain('`pr-129` dist-tag automatically')
  })

  test('adds explicit remote overrides to manual preview runbook commands', async () => {
    const pullRequest = {
      number: 129,
      html_url: 'https://github.com/org/repo/pull/129',
      title: 'feat(core): release preview',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/release-preview' },
    } satisfies Github.PullRequest

    const packages = [
      {
        scope: 'core',
        name: Pkg.Moniker.parse('@kitz/core'),
        path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
      },
    ] satisfies readonly Api.Analyzer.Workspace.Package[]

    const analysis = Analysis.make({
      impacts: [
        Impact.make({
          package: packages[0]!,
          bump: 'minor',
          commits: [makeCascadeCommit('core', 'preview release')],
          currentVersion: Option.some(Semver.fromString('1.0.0')),
        }),
      ],
      cascades: [],
      unchanged: [],
      tags: ['@kitz/core@1.0.0'],
    })
    const { layer: gitLayer } = await Effect.runPromise(
      Git.Memory.makeWithState({
        root: '/repo',
        branch: 'feature/release-preview',
        headSha: Git.Sha.make('abc1234'),
        tags: ['@kitz/core@1.0.0'],
      }),
    )

    const summary = await Effect.runPromise(
      buildPreviewDoctorSummary({
        config: makeResolvedConfig(),
        analysis,
        packages,
        pullRequest,
        diff: {
          files: [{ path: 'packages/core/src/index.ts', status: 'modified' }],
          affectedPackages: ['@kitz/core'],
        },
        explicitDiffRemote: 'fork',
        blockingTitleChecks: false,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            FileSystemLayer,
            gitLayer,
            makeMockSpawnerLayer('mock-user'),
            Env.Test({
              cwd: Fs.Path.AbsDir.fromString('/repo/'),
              vars: { PR_NUMBER: '129' },
            }),
            Fs.Memory.layer({
              '/repo/packages/core/package.json': JSON.stringify({
                name: '@kitz/core',
                version: '1.0.0',
              }),
            }),
          ),
        ),
      ),
    )

    expect(summary.summary?.runbook?.commands).toEqual([
      'bun run release:build',
      'PR_NUMBER=129 bun run release plan --lifecycle ephemeral',
      'bun run release doctor --remote fork',
      'bun run release apply --yes',
    ])
    expect(summary.summary?.deferredChecks).toContainEqual({
      label: Api.Lint.Rules.EnvGitRemote.data.description,
      ruleId: Api.Lint.Rules.EnvGitRemote.data.id,
      preventsDescriptions: Api.Lint.Rules.EnvGitRemote.data.preventsDescriptions,
      checkCommand: 'bun run release doctor --remote fork --onlyRule env.git-remote',
    })
  })
})
