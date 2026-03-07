import { CommandExecutor } from '@effect/platform'
import { Effect, Layer, Sink, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { NpmCliError, hasVersion } from './cli.js'

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

const makeCommandExecutorLayer = () => {
  const executor: CommandExecutor.CommandExecutor = {
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

      if (spec === 'react@19.2.0') {
        return Effect.succeed(makeProcess('"19.2.0"\n', 0)) as any
      }

      if (spec === 'react@0.0.0-nope') {
        return Effect.succeed(
          makeProcess(
            JSON.stringify(
              {
                error: {
                  code: 'E404',
                  summary: 'No match found for version 0.0.0-nope',
                },
              },
              null,
              2,
            ) + '\n',
            1,
          ),
        ) as any
      }

      if (spec === 'react@18.3.1') {
        return Effect.succeed(
          makeProcess(
            JSON.stringify(
              {
                error: {
                  code: 'E429',
                  summary: 'registry rate limited',
                },
              },
              null,
              2,
            ) + '\n',
            1,
          ),
        ) as any
      }

      return Effect.die(`Unexpected npm view spec: ${spec ?? 'unknown'}`) as any
    },
    string: () => Effect.die('string not implemented in mock command executor') as any,
    lines: () => Effect.die('lines not implemented in mock command executor') as any,
    stream: () => Stream.empty,
    streamLines: () => Stream.empty,
  }

  return Layer.succeed(CommandExecutor.CommandExecutor, executor)
}

describe('npm-registry cli', () => {
  test('hasVersion returns true when npm view finds the exact version', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '19.2.0').pipe(Effect.provide(makeCommandExecutorLayer())),
    )

    expect(result).toBe(true)
  })

  test('hasVersion returns false for npm E404 responses', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '0.0.0-nope').pipe(Effect.provide(makeCommandExecutorLayer())),
    )

    expect(result).toBe(false)
  })

  test('hasVersion fails for non-404 npm view errors', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '18.3.1').pipe(Effect.flip, Effect.provide(makeCommandExecutorLayer())),
    )

    expect(result).toBeInstanceOf(NpmCliError)
    expect(result.context.detail).toContain('rate limited')
  })
})
