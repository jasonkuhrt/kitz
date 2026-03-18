import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  formatGithubReleaseTitle,
  Publishing,
  resolvePublishChannel,
  resolvePublishSemantics,
} from './publishing.js'

describe('Publishing', () => {
  test('defaults every lifecycle to manual', () => {
    const publishing = Publishing.decodeSync({})

    expect(publishing.official.mode).toBe('manual')
    expect(publishing.candidate.mode).toBe('manual')
    expect(publishing.ephemeral.mode).toBe('manual')
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

  test('resolves ephemeral dist-tag semantics independently of candidate config', () => {
    const semantics = resolvePublishSemantics({
      lifecycle: 'ephemeral',
      candidateTag: 'candidate',
      tag: 'preview-42',
    })

    expect(semantics.distTag).toBe('preview-42')
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
