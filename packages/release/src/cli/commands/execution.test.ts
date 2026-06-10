import { Env } from '@kitz/env'
import { Flo } from '@kitz/flo'
import { Test } from '@kitz/test'
import { Effect, Exit, Layer, Stream, Terminal } from 'effect'
import { TestConsole } from 'effect/testing'
import { describe, expect } from 'bun:test'
import * as Api from '../../api/__.js'
import { confirm, runObservableCommand } from './execution.js'

describe('command execution helpers', () => {
  const date = new Date('2026-01-01T00:00:00.000Z')
  const executionResult = {
    releasedPackages: ['@kitz/core'],
    createdTags: [],
    createdGHReleases: [],
  }
  const layer = Layer.mergeAll(Env.Test(), TestConsole.layer)
  const activityStarted = Flo.Activity.Started.make({
    activity: 'publish',
    timestamp: date,
    resumed: false,
  })
  const activityCompleted = Flo.Activity.Completed.make({
    activity: 'publish',
    timestamp: date,
    resumed: false,
    durationMs: 1,
  })
  const activityFailed = Flo.Activity.Failed.make({
    activity: 'publish',
    timestamp: date,
    error: 'boom',
  })
  const terminalLayer = (input: Effect.Effect<string, Terminal.QuitError>) =>
    Layer.succeed(Terminal.Terminal)(
      Terminal.make({
        columns: Effect.succeed(80),
        rows: Effect.succeed(24),
        readInput: Effect.never,
        readLine: input,
        display: () => Effect.void,
      }),
    )

  Test.effect('streams lifecycle events before the shared completion summary', () =>
    Effect.gen(function* () {
      const execution = yield* runObservableCommand({
        events: Stream.fromIterable([activityStarted, activityCompleted]),
        execute: Effect.succeed(executionResult),
      })
      const logs = yield* TestConsole.logLines

      expect(execution.releasedPackages).toEqual(['@kitz/core'])
      expect(logs.slice(0, 2)).toEqual(['  › Starting: publish', '✓ Completed: publish'])
      expect(logs[2]).toContain('[DONE] 1 package released.')
    }).pipe(Effect.provide(layer)),
  )

  Test.effect('routes failed lifecycle events to stderr', () =>
    Effect.gen(function* () {
      yield* runObservableCommand({
        events: Stream.fromIterable([activityStarted, activityFailed]),
        execute: Effect.succeed(executionResult),
      })
      const logs = yield* TestConsole.logLines
      const errors = yield* TestConsole.errorLines

      expect(logs[0]).toBe('  › Starting: publish')
      expect(logs[1]).toContain('[DONE] 1 package released.')
      expect(errors).toEqual(['✗ Failed: publish - boom'])
    }).pipe(Effect.provide(layer)),
  )

  Test.effect('does not render completion summary when execute fails', () =>
    Effect.gen(function* () {
      const failure = new Api.Executor.Errors.ExecutorPreflightError({
        context: { check: 'env.npm-authenticated', detail: 'missing token' },
      })
      const exit = yield* Effect.exit(
        runObservableCommand({
          events: Stream.fromIterable([activityStarted]),
          execute: Effect.fail(failure),
        }),
      )
      const logs = yield* TestConsole.logLines

      expect(Exit.isFailure(exit)).toBe(true)
      expect(logs.join('\n')).not.toContain('[DONE]')
    }).pipe(Effect.provide(layer)),
  )

  Test.effect('confirms only yes-like answers and treats input failure as no', () =>
    Effect.gen(function* () {
      const results = yield* Effect.all([
        confirm('Continue?').pipe(Effect.provide(terminalLayer(Effect.succeed('y')))),
        confirm('Continue?').pipe(Effect.provide(terminalLayer(Effect.succeed(' YES ')))),
        confirm('Continue?').pipe(Effect.provide(terminalLayer(Effect.succeed('no')))),
        confirm('Continue?').pipe(
          Effect.provide(terminalLayer(Effect.fail(new Terminal.QuitError()))),
        ),
      ])

      expect(results).toEqual([true, true, false, false])
    }),
  )
})
