import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Violation } from '../models/violation.js'
import { ReleaseContext } from '../services/__.js'
import { rule } from './env-publish-channel-ready.js'

const envLayer = (vars: Record<string, string>) =>
  Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/'), vars })

describe('env.publish-channel-ready', () => {
  test('returns manual metadata when publishing is declared as manual', async () => {
    const result = await Effect.runPromise(
      rule.check({ surface: 'execution' }).pipe(
        Effect.provide(
          ReleaseContext.make({
            lifecycle: 'official',
            publishing: {
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: { mode: 'manual' },
            },
          }),
        ),
        Effect.provide(envLayer({})),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected manual metadata')
    }

    expect(result.metadata).toEqual({
      status: 'manual',
      mode: 'manual',
    })
  })

  test('violates when trusted publishing is configured but OIDC env is missing in GitHub Actions', async () => {
    const layer = ReleaseContext.make({
      lifecycle: 'official',
      publishing: {
        official: { mode: 'github-trusted', workflow: 'trunk.yml' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'manual' },
      },
    })

    const result = await Effect.runPromise(
      rule.check({ surface: 'execution' }).pipe(
        Effect.provide(layer),
        Effect.provide(
          envLayer({
            GITHUB_ACTIONS: 'true',
            GITHUB_WORKFLOW_REF: 'jasonkuhrt/kitz/.github/workflows/trunk.yml@refs/heads/main',
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('github-trusted')
  })

  test('defers to the publish workflow in preview mode when running on a non-publish workflow', async () => {
    const layer = ReleaseContext.make({
      lifecycle: 'ephemeral',
      publishing: {
        official: { mode: 'manual' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'github-token', workflow: 'publish-pr.yml', tokenEnv: 'NPM_TOKEN' },
      },
    })

    const result = await Effect.runPromise(
      rule.check({ surface: 'preview' }).pipe(
        Effect.provide(layer),
        Effect.provide(
          envLayer({
            GITHUB_ACTIONS: 'true',
            GITHUB_WORKFLOW_REF: 'jasonkuhrt/kitz/.github/workflows/pr.yml@refs/pull/129/merge',
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected preview metadata')
    }

    const metadata = result.metadata
    expect(metadata.status).toBe('deferred')
    expect(metadata.workflow).toBe('publish-pr.yml')
    expect(metadata.activeWorkflow).toBe('pr.yml')
  })

  test('violates when github-token publishing is active but the npm token env is blank', async () => {
    const result = await Effect.runPromise(
      rule.check({ surface: 'execution' }).pipe(
        Effect.provide(
          ReleaseContext.make({
            lifecycle: 'ephemeral',
            publishing: {
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: {
                mode: 'github-token',
                workflow: 'publish-pr.yml',
                tokenEnv: 'NPM_TOKEN',
              },
            },
          }),
        ),
        Effect.provide(
          envLayer({
            GITHUB_ACTIONS: 'true',
            GITHUB_WORKFLOW_REF: 'jasonkuhrt/kitz/.github/workflows/publish-pr.yml@refs/heads/main',
            NPM_TOKEN: '   ',
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) {
      throw new Error('expected a violation')
    }

    expect(result.summary).toContain('expects an npm token')
  })

  test('returns ready metadata when github-token publishing has credentials in the active workflow', async () => {
    const result = await Effect.runPromise(
      rule.check({ surface: 'execution' }).pipe(
        Effect.provide(
          ReleaseContext.make({
            lifecycle: 'ephemeral',
            publishing: {
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: {
                mode: 'github-token',
                workflow: 'publish-pr.yml',
                tokenEnv: 'NPM_TOKEN',
              },
            },
          }),
        ),
        Effect.provide(
          envLayer({
            GITHUB_ACTIONS: 'true',
            GITHUB_WORKFLOW_REF: 'jasonkuhrt/kitz/.github/workflows/publish-pr.yml@refs/heads/main',
            NPM_TOKEN: 'token-123',
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected ready metadata')
    }

    expect(result.metadata).toEqual({
      status: 'ready',
      mode: 'github-token',
      workflow: 'publish-pr.yml',
      tokenEnv: 'NPM_TOKEN',
    })
  })

  test('decodes options through the rule schema, defaulting surface to execution', async () => {
    const result = await Effect.runPromise(
      rule.run({}).pipe(
        Effect.provide(
          ReleaseContext.make({
            lifecycle: 'official',
            publishing: {
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: { mode: 'manual' },
            },
          }),
        ),
        Effect.provide(envLayer({})),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected manual metadata')
    }

    expect(result.metadata).toEqual({ status: 'manual', mode: 'manual' })
  })
})
