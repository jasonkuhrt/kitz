import { ChildProcessSpawner } from 'effect/unstable/process'
import * as PlatformError from 'effect/PlatformError'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { rule } from './env-npm-authenticated.js'

const textEncoder = new TextEncoder()

const makeSpawnerLayer = (mode: 'success' | 'failure') =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => {
      if (mode === 'failure') {
        return Effect.fail(
          new PlatformError.SystemError({
            _tag: 'Unknown',
            module: 'ChildProcess',
            method: 'spawn',
          }),
        ) as any
      }
      return Effect.succeed(
        ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          stderr: Stream.empty,
          stdin: Effect.void as any,
          stdout: Stream.fromIterable([textEncoder.encode('jasonkuhrt\n')]),
          all: Stream.fromIterable([textEncoder.encode('jasonkuhrt\n')]),
          getInputFd: () => Effect.void as any,
          getOutputFd: () => Stream.empty,
        }),
      )
    }),
  )

describe('env.npm-authenticated', () => {
  test('returns a guided fix when npm whoami fails', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makeSpawnerLayer('failure')),
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
        Effect.provide(makeSpawnerLayer('success')),
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
