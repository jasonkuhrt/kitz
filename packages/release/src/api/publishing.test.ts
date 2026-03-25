import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { PublishChannelGitHubToken, Publishing, defaultPublishing, resolvePublishChannel } from './publishing.js'

describe('Publishing', () => {
  test('defaults every lifecycle to manual', () => {
    const publishing = defaultPublishing()

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
})
