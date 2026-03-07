import { CommandExecutor } from '@effect/platform'
import { Effect, Layer, Option, Sink, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-versions-unpublished.js'

const textEncoder = new TextEncoder()

const makeProcess = (stdout: string, exitCode: number): CommandExecutor.Process => ({
  [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  pid: CommandExecutor.ProcessId(1),
  exitCode: Effect.succeed(CommandExecutor.ExitCode(exitCode)),
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  stderr: Stream.empty,
  stdin: Sink.drain,
  stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
})

const makeCommandExecutorLayer = (exists: boolean) =>
  Layer.succeed(CommandExecutor.CommandExecutor, {
    [CommandExecutor.TypeId]: CommandExecutor.TypeId,
    exitCode: () => Effect.succeed(CommandExecutor.ExitCode(0)),
    start: (command) => {
      if (
        command?._tag !== 'StandardCommand' ||
        command.command !== 'npm' ||
        command.args?.[0] !== '--silent' ||
        command.args?.[1] !== 'view'
      ) {
        return Effect.die(`Unexpected command in mock executor: ${command?.command ?? 'unknown'}`) as any
      }

      const spec = command.args?.[2]
      if (spec !== '@kitz/core@1.0.1') {
        return Effect.die(`Unexpected npm view spec: ${spec ?? 'unknown'}`) as any
      }

      return Effect.succeed(
        exists
          ? makeProcess('"1.0.1"\n', 0)
          : makeProcess(
              JSON.stringify(
                {
                  error: {
                    code: 'E404',
                    summary: 'No match found for version 1.0.1',
                  },
                },
                null,
                2,
              ) + '\n',
              1,
            ),
      ) as any
    },
    string: () => Effect.die('string not implemented in mock command executor') as any,
    lines: () => Effect.die('lines not implemented in mock command executor') as any,
    stream: () => Stream.empty,
    streamLines: () => Stream.empty,
  } satisfies CommandExecutor.CommandExecutor)

const releasePlanLayer = ReleasePlan.make([
  {
    packageName: Pkg.Moniker.parse('@kitz/core'),
    packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
    version: Semver.fromString('1.0.1'),
  },
])

describe('plan.versions-unpublished', () => {
  test('violates when the planned package version already exists on npm', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(releasePlanLayer),
        Effect.provide(makeCommandExecutorLayer(true)),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('@kitz/core@1.0.1')
  })

  test('passes when the planned package version is still unpublished', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(releasePlanLayer),
        Effect.provide(makeCommandExecutorLayer(false)),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected rule metadata')
    }

    expect(result.metadata).toEqual({ packageCount: 1 })
  })
})
