import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { rule } from './env-git-remote.js'

describe('env.git-remote', () => {
  test('returns remote metadata when the configured remote is reachable', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(Git.Memory.make({ remoteUrl: 'git@github.com:jasonkuhrt/kitz.git' })),
        Effect.provideService(RuleOptionsService, { remote: 'origin' }),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected git remote metadata')
    }

    expect(result.metadata).toEqual({
      url: 'git@github.com:jasonkuhrt/kitz.git',
    })
  })

  test('reports a violation when the remote is unavailable', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provideService(Git.Git, {
          getRemoteUrl: () =>
            Effect.fail(
              new Git.GitError({
                context: {
                  operation: 'getRemoteUrl',
                  detail: 'remote not found',
                },
                cause: new Error('remote not found'),
              }),
            ),
        } as any),
        Effect.provideService(RuleOptionsService, { remote: 'upstream' }),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (
      Violation.is(result) ||
      result === undefined ||
      !('violation' in result) ||
      !result.violation
    ) {
      throw new Error('expected a violation')
    }

    expect(result.violation.summary).toContain('git remote "upstream" is unavailable')
    expect(result.violation.location._tag).toBe('ViolationLocationEnvironment')
  })
})
