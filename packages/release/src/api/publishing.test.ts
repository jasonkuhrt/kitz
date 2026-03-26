import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import * as Version from './version/__.js'
import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { Ephemeral as EphemeralItem } from './planner/models/item-ephemeral.js'
import { Plan } from './planner/models/plan.js'
import {
  formatGithubReleaseTitle,
  formatEphemeralDistTag,
  PublishChannelGitHubToken,
  Publishing,
  resolvePublishChannel,
  resolvePlanPrNumber,
  resolvePublishSemantics,
  resolvePublishSemanticsForPlan,
} from './publishing.js'

describe('Publishing', () => {
  const ephemeralPlan = Plan.make({
    lifecycle: 'ephemeral',
    timestamp: '2026-03-18T00:00:00.000Z',
    releases: [
      EphemeralItem.make({
        package: {
          name: Pkg.Moniker.parse('@kitz/core'),
          scope: 'core',
          path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
        },
        commits: [makeCascadeCommit('core', 'preview release')],
        prerelease: Version.Ephemeral.make({
          prNumber: 42,
          iteration: 1,
          sha: Git.Sha.make('abc1234'),
        }),
      }),
    ],
    cascades: [],
  })

  test('defaults every lifecycle to manual', () => {
    const publishing = Publishing.decodeSync({})

    expect(publishing.official.mode).toBe('manual')
    expect(publishing.candidate.mode).toBe('manual')
    expect(publishing.ephemeral.mode).toBe('manual')
  })

  test('defaults github token channels to NPM_TOKEN', () => {
    const channel = Schema.decodeSync(PublishChannelGitHubToken)({
      mode: 'github-token',
      workflow: 'publish-pr.yml',
    })

    expect(channel.tokenEnv).toBe('NPM_TOKEN')
  })

  test('resolves the active channel by lifecycle', () => {
    const publishing = Publishing.decodeSync({
      official: { mode: 'github-trusted', workflow: 'trunk.yml' },
      ephemeral: { mode: 'github-token', workflow: 'publish-pr.yml', tokenEnv: 'NPM_TOKEN' },
    })

    expect(resolvePublishChannel(publishing, 'official')).toEqual({
      mode: 'github-trusted',
      workflow: 'trunk.yml',
    })
    expect(resolvePublishChannel(publishing, 'ephemeral')).toEqual({
      mode: 'github-token',
      workflow: 'publish-pr.yml',
      tokenEnv: 'NPM_TOKEN',
    })
  })

  test('resolves candidate dist-tag semantics from a custom override', () => {
    const semantics = resolvePublishSemantics({
      lifecycle: 'candidate',
      tag: 'candidate',
    })

    expect(semantics.distTag).toBe('candidate')
    expect(semantics.prerelease).toBe(true)
    expect(semantics.forcePushTag).toBe(true)
    expect(semantics.githubReleaseStyle).toBe('dist-tagged')
    expect(
      formatGithubReleaseTitle(semantics, {
        packageName: '@kitz/core',
        version: '1.1.0-next.1',
      }),
    ).toBe('@kitz/core @candidate')
  })

  test('formats first-class per-PR ephemeral dist-tags', () => {
    expect(formatEphemeralDistTag(42)).toBe('pr-42')
  })

  test('derives the ephemeral dist-tag from the planned PR number', () => {
    expect(resolvePlanPrNumber(ephemeralPlan)).toBe(42)

    const semantics = resolvePublishSemanticsForPlan({
      plan: ephemeralPlan,
      candidateTag: 'candidate',
    })

    expect(semantics.distTag).toBe('pr-42')
    expect(semantics.prerelease).toBe(true)
    expect(semantics.forcePushTag).toBe(false)
    expect(semantics.githubReleaseStyle).toBe('versioned')
  })

  test('still allows explicit ephemeral dist-tag overrides', () => {
    const semantics = resolvePublishSemanticsForPlan({
      plan: ephemeralPlan,
      tag: 'preview-42',
    })

    expect(semantics.distTag).toBe('preview-42')
  })

  test('resolves ephemeral dist-tag semantics independently of candidate config', () => {
    const semantics = resolvePublishSemantics({
      lifecycle: 'ephemeral',
      candidateTag: 'candidate',
      prNumber: 42,
    })

    expect(semantics.distTag).toBe('pr-42')
    expect(semantics.prerelease).toBe(true)
    expect(semantics.forcePushTag).toBe(false)
    expect(semantics.githubReleaseStyle).toBe('versioned')
    expect(
      formatGithubReleaseTitle(semantics, {
        packageName: '@kitz/core',
        version: '0.0.0-pr.42.1.gabc1234',
      }),
    ).toBe('@kitz/core v0.0.0-pr.42.1.gabc1234')
  })

  test('keeps the publishing schema static helpers usable', async () => {
    const publishing = Publishing.decodeSync({
      candidate: { mode: 'github-token', workflow: 'publish-candidate.yml' },
    })

    expect(publishing.candidate).toEqual({
      mode: 'github-token',
      workflow: 'publish-candidate.yml',
      tokenEnv: 'NPM_TOKEN',
    })
    expect(Publishing.encodeSync(publishing)).toEqual({
      official: { mode: 'manual' },
      candidate: {
        mode: 'github-token',
        workflow: 'publish-candidate.yml',
        tokenEnv: 'NPM_TOKEN',
      },
      ephemeral: { mode: 'manual' },
    })

    const decoded = await Effect.runPromise(
      Publishing.decode({
        ephemeral: { mode: 'github-trusted', workflow: 'publish-preview.yml' },
      }),
    )
    const encoded = await Effect.runPromise(Publishing.encode(decoded))

    expect(encoded).toEqual({
      official: { mode: 'manual' },
      candidate: { mode: 'manual' },
      ephemeral: { mode: 'github-trusted', workflow: 'publish-preview.yml' },
    })
  })
})
