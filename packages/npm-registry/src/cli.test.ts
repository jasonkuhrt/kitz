import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Fs } from '@kitz/fs'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { NpmCliError, hasVersion, pack, publish } from './cli.js'

const textEncoder = new TextEncoder()

const makeHandle = (stdout: string, exitCode: number): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stderr: Stream.empty,
    stdin: Effect.void as any,
    stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    all: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    getInputFd: () => Effect.void as any,
    getOutputFd: () => Stream.empty,
  })

const makeSpawnerLayer = () => {
  const spawner = ChildProcessSpawner.make((command) => {
    const standard = ChildProcess.isStandardCommand(command) ? command : undefined
    if (!standard) {
      return Effect.die('Unexpected piped command in mock spawner') as any
    }

    const args = standard.args

    // npm view
    if (args?.[0] === '--silent' && args?.[1] === 'view') {
      const spec = args?.[2]

      if (spec === 'react@19.2.0') {
        return Effect.succeed(makeHandle('"19.2.0"\n', 0))
      }

      if (spec === 'react@0.0.0-nope') {
        return Effect.succeed(
          makeHandle(
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
        )
      }

      if (spec === 'react@18.3.1') {
        return Effect.succeed(
          makeHandle(
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
        )
      }

      return Effect.die(`Unexpected npm view spec: ${spec ?? 'unknown'}`)
    }

    // npm pack
    if (args?.[0] === 'pack') {
      return Effect.succeed(makeHandle('[{"filename":"react-19.2.0.tgz"}]\n', 0))
    }

    // npm publish
    if (args?.[0] === 'publish') {
      return Effect.succeed(makeHandle('', 0))
    }

    return Effect.die(`Unexpected command in mock spawner: ${standard.command}`)
  })

  return Layer.succeed(ChildProcessSpawner, spawner)
}

describe('npm-registry cli', () => {
  test('pack returns the tarball path emitted by npm', async () => {
    const result = await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/react/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
      }).pipe(Effect.provide(makeSpawnerLayer())),
    )

    expect(Fs.Path.toString(result.tarball)).toBe('/repo/.release/artifacts/react-19.2.0.tgz')
    expect(result.filename).toBe('react-19.2.0.tgz')
  })

  test('publish accepts a prepared tarball path', async () => {
    await Effect.runPromise(
      publish({
        tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/react-19.2.0.tgz'),
        access: 'public',
      }).pipe(Effect.provide(makeSpawnerLayer())),
    )
  })

  test('hasVersion returns true when npm view finds the exact version', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '19.2.0').pipe(Effect.provide(makeSpawnerLayer())),
    )

    expect(result).toBe(true)
  })

  test('hasVersion returns false for npm E404 responses', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '0.0.0-nope').pipe(Effect.provide(makeSpawnerLayer())),
    )

    expect(result).toBe(false)
  })

  test('hasVersion fails for non-404 npm view errors', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '18.3.1').pipe(Effect.flip, Effect.provide(makeSpawnerLayer())),
    )

    expect(result).toBeInstanceOf(NpmCliError)
    expect(result.context.detail).toContain('rate limited')
  })
})
