import { describe, expect, test } from 'vitest'
import { Publishing, resolvePublishChannel } from './publishing.js'

describe('Publishing', () => {
  test('defaults every lifecycle to manual', () => {
    const publishing = Publishing.make({})

    expect(publishing.official.mode).toBe('manual')
    expect(publishing.candidate.mode).toBe('manual')
    expect(publishing.ephemeral.mode).toBe('manual')
  })

  test('resolves the active channel by lifecycle', () => {
    const publishing = Publishing.make({
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
