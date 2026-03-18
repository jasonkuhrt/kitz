import { Github } from '@kitz/github'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Api from '../../api/__.js'
import {
  parsePositiveIntegerOption,
  renderPreviewPublishReport,
  resolvePreviewPublishSurface,
  toPreviewPublishReport,
} from './history-lib.js'

const context = {
  branch: 'feature/release-preview',
  explicitPrNumber: null,
  target: {
    owner: 'org',
    repo: 'repo',
    source: 'git:origin',
  },
  token: null,
} satisfies Api.Explorer.ResolvedGitHubContext

const metadataBlock = Api.Commentator.renderMetadataBlock({
  headSha: 'abc1234',
  publishState: 'published',
  publishHistory: [
    {
      package: '@kitz/core',
      version: '0.0.0-pr.129.2.gabc1234',
      iteration: 2,
      sha: 'abc1234',
      timestamp: '2026-03-18T12:00:00.000Z',
      runId: 'run-2',
    },
    {
      package: '@kitz/core',
      version: '0.0.0-pr.129.1.g0000001',
      iteration: 1,
      sha: '0000001',
      timestamp: '2026-03-18T11:00:00.000Z',
      runId: 'run-1',
    },
  ],
})

describe('release history helpers', () => {
  test('parses positive integer options and rejects invalid values', async () => {
    expect(await Effect.runPromise(parsePositiveIntegerOption(undefined, 'limit'))).toBeUndefined()
    expect(await Effect.runPromise(parsePositiveIntegerOption(' 3 ', 'limit'))).toBe(3)
    await expect(Effect.runPromise(parsePositiveIntegerOption('0', 'limit'))).rejects.toThrow(
      /positive integer/,
    )
    await expect(Effect.runPromise(parsePositiveIntegerOption('abc', 'pr'))).rejects.toThrow(
      /positive integer/,
    )
  })

  test('resolves publish metadata from the connected pull request preview comment', async () => {
    const { layer } = await Effect.runPromise(
      Github.Memory.makeWithState({
        pullRequests: [
          {
            number: 129,
            html_url: 'https://github.com/org/repo/pull/129',
            title: 'feat(core): release preview',
            body: null,
            base: { ref: 'main' },
            head: { ref: 'feature/release-preview' },
          },
        ],
        issueComments: [
          {
            issueNumber: 129,
            comment: {
              id: 41,
              body: `${metadataBlock}\n\npreview body`,
              html_url: 'https://github.com/org/repo/pull/129#issuecomment-41',
              user: { type: 'Bot' },
            },
          },
        ],
      }),
    )

    const surface = await Effect.runPromise(
      resolvePreviewPublishSurface(context).pipe(Effect.provide(layer)),
    )

    expect(surface.pullRequest.number).toBe(129)
    expect(surface.issueComment.id).toBe(41)
    expect(surface.metadata.publishState).toBe('published')
    expect(surface.metadata.publishHistory).toHaveLength(2)
  })

  test('prefers an explicit PR number override over the connected branch', async () => {
    const { layer } = await Effect.runPromise(
      Github.Memory.makeWithState({
        pullRequests: [
          {
            number: 129,
            html_url: 'https://github.com/org/repo/pull/129',
            title: 'feat(core): release preview',
            body: null,
            base: { ref: 'main' },
            head: { ref: 'feature/release-preview' },
          },
          {
            number: 130,
            html_url: 'https://github.com/org/repo/pull/130',
            title: 'feat(cli): alternate release preview',
            body: null,
            base: { ref: 'main' },
            head: { ref: 'feature/alternate' },
          },
        ],
        issueComments: [
          {
            issueNumber: 130,
            comment: {
              id: 55,
              body: `${metadataBlock}\n\npreview body`,
              html_url: 'https://github.com/org/repo/pull/130#issuecomment-55',
              user: { type: 'Bot' },
            },
          },
        ],
      }),
    )

    const surface = await Effect.runPromise(
      resolvePreviewPublishSurface(context, { prNumber: 130 }).pipe(Effect.provide(layer)),
    )

    expect(surface.pullRequest.number).toBe(130)
    expect(surface.issueComment.id).toBe(55)
  })

  test('fails when the preview comment does not exist yet', async () => {
    const { layer } = await Effect.runPromise(
      Github.Memory.makeWithState({
        pullRequests: [
          {
            number: 129,
            html_url: 'https://github.com/org/repo/pull/129',
            title: 'feat(core): release preview',
            body: null,
            base: { ref: 'main' },
            head: { ref: 'feature/release-preview' },
          },
        ],
      }),
    )

    const result = await Effect.runPromise(
      resolvePreviewPublishSurface(context).pipe(Effect.provide(layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected history lookup to fail')
    }

    expect(result.failure.message).toContain('release preview comment')
  })

  test('renders truncated publish history reports in newest-first order', () => {
    const report = toPreviewPublishReport(
      {
        pullRequest: {
          number: 129,
          html_url: 'https://github.com/org/repo/pull/129',
        },
        issueComment: {
          id: 41,
          html_url: 'https://github.com/org/repo/pull/129#issuecomment-41',
        },
        metadata: Api.Commentator.parseMetadata(metadataBlock)!,
      },
      { limit: 1 },
    )

    expect(report.truncated).toBe(true)
    expect(report.publishHistory).toHaveLength(1)
    expect(report.publishHistory[0]?.version).toBe('0.0.0-pr.129.2.gabc1234')
    expect(renderPreviewPublishReport(report)).toContain('Publish history (showing 1 of 2):')
  })
})
