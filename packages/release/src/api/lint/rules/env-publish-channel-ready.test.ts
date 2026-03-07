import { Effect } from 'effect'
import { afterEach, describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { ReleaseContext } from '../services/__.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { type PublishChannelReadyMetadata, rule } from './env-publish-channel-ready.js'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, originalEnv)
})

describe('env.publish-channel-ready', () => {
  test('violates when trusted publishing is configured but OIDC env is missing in GitHub Actions', async () => {
    process.env['GITHUB_ACTIONS'] = 'true'
    process.env['GITHUB_WORKFLOW_REF'] =
      'jasonkuhrt/kitz/.github/workflows/trunk.yml@refs/heads/main'
    delete process.env['ACTIONS_ID_TOKEN_REQUEST_URL']
    delete process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN']

    const layer = ReleaseContext.make({
      lifecycle: 'official',
      publishing: {
        official: { mode: 'github-trusted', workflow: 'trunk.yml' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'manual' },
      },
    })

    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(layer),
        Effect.provideService(RuleOptionsService, { surface: 'execution' }),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('github-trusted')
  })

  test('defers to the publish workflow in preview mode when running on a non-publish workflow', async () => {
    process.env['GITHUB_ACTIONS'] = 'true'
    process.env['GITHUB_WORKFLOW_REF'] =
      'jasonkuhrt/kitz/.github/workflows/pr.yml@refs/pull/129/merge'

    const layer = ReleaseContext.make({
      lifecycle: 'ephemeral',
      publishing: {
        official: { mode: 'manual' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'github-token', workflow: 'publish-pr.yml', tokenEnv: 'NPM_TOKEN' },
      },
    })

    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(layer),
        Effect.provideService(RuleOptionsService, { surface: 'preview' }),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected preview metadata')
    }

    const metadata = result.metadata as PublishChannelReadyMetadata
    expect(metadata.status).toBe('deferred')
    expect(metadata.workflow).toBe('publish-pr.yml')
    expect(metadata.activeWorkflow).toBe('pr.yml')
  })
})
