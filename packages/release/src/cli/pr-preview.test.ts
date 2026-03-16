import { Semver } from '@kitz/semver'
import { Github } from '@kitz/github'
import { Effect, Ref, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Api from '../api/__.js'
import { CommitDisplay, Forecast, ForecastRelease } from '../api/forecaster/models.js'
import { PreviewBlockingError, upsertPullRequestPreviewComment } from './pr-preview.js'

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
})
