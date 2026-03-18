import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  formatGithubReleaseTitle,
  Publishing,
  resolvePublishChannel,
  resolvePublishSemantics,
} from './publishing.js'

describe('Publishing', () => {
  test('defaults every lifecycle to manual', () => {
    const publishing = Schema.decodeSync(Publishing)({})

    expect(publishing.official.mode).toBe('manual')
    expect(publishing.candidate.mode).toBe('manual')
    expect(publishing.ephemeral.mode).toBe('manual')
  })

  test('resolves the active channel by lifecycle', () => {
    const publishing = Schema.decodeSync(Publishing)({
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
})
