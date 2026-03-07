import { CommandExecutor } from '@effect/platform'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { rule } from './env-npm-authenticated.js'

const makeCommandExecutorLayer = (mode: 'success' | 'failure') =>
  Layer.succeed(CommandExecutor.CommandExecutor, {
    [CommandExecutor.TypeId]: CommandExecutor.TypeId,
    exitCode: () => Effect.succeed(CommandExecutor.ExitCode(0)),
    start: () => Effect.die('start not implemented in mock command executor') as any,
    string: () =>
      mode === 'success'
        ? Effect.succeed('jasonkuhrt\n')
        : (Effect.fail(new Error('ENEEDAUTH')) as any),
    lines: () => Effect.die('lines not implemented in mock command executor') as any,
    stream: () => Stream.empty,
    streamLines: () => Stream.empty,
  } satisfies CommandExecutor.CommandExecutor)

describe('env.npm-authenticated', () => {
  test('returns a guided fix when npm whoami fails', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makeCommandExecutorLayer('failure')),
        Effect.provideService(RuleOptionsService, {}),
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

    expect(result.violation.fix?._tag).toBe('ViolationGuideFix')
    if (!result.violation.fix || result.violation.fix._tag !== 'ViolationGuideFix') {
      throw new Error('expected a guide fix')
    }

    expect(result.violation.fix.steps[1]?.description).toContain('npm login')
    expect(result.violation.fix.docs?.map((doc) => doc.label)).toEqual([
      'npm login',
      'npm access',
      'npm two-factor authentication',
    ])
  })

  test('passes when npm whoami succeeds', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makeCommandExecutorLayer('success')),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected rule metadata')
    }

    expect(result.metadata).toEqual({ username: 'jasonkuhrt' })
  })
})
