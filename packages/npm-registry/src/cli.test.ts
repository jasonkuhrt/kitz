import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Fs } from '@kitz/fs'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { NpmCliError, hasVersion, pack, publish, whoami } from './cli.js'

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
  const commands: string[][] = []
  const spawner = ChildProcessSpawner.make((command) => {
    const standard = ChildProcess.isStandardCommand(command) ? command : undefined
    if (!standard) {
      return Effect.die('Unexpected piped command in mock spawner') as any
    }

    const args = standard.args
    const cwd = standard.options?.cwd
    commands.push(args ? [...args] : [])

    if (args?.[0] === 'whoami') {
      const registry = args?.[2]

      if (registry === 'https://registry.example.test/empty') {
        return Effect.succeed(makeHandle('   \n', 0))
      }

      if (registry === 'https://registry.example.test/fail') {
        return Effect.fail(new Error('spawn failed'))
      }

      return Effect.succeed(makeHandle('octocat\n', 0))
    }

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

      if (spec === 'react@17.0.0') {
        return Effect.succeed(makeHandle('', 1))
      }

      return Effect.die(`Unexpected npm view spec: ${spec ?? 'unknown'}`)
    }

    // npm pack
    if (args?.[0] === 'pack') {
      if (cwd?.startsWith('/repo/packages/invalid-json')) {
        return Effect.succeed(makeHandle('{not json}\n', 0))
      }

      if (cwd?.startsWith('/repo/packages/empty')) {
        return Effect.succeed(makeHandle('[]\n', 0))
      }

      return Effect.succeed(makeHandle('[{"filename":"react-19.2.0.tgz"}]\n', 0))
    }

    // npm publish
    if (args?.[0] === 'publish') {
      if (args?.[1] === '/repo/.release/artifacts/fail-exit.tgz') {
        return Effect.succeed(makeHandle('', 1))
      }

      if (args?.[1] === '/repo/.release/artifacts/fail-spawn.tgz') {
        return Effect.fail(new Error('spawn failed'))
      }

      return Effect.succeed(makeHandle('', 0))
    }

    return Effect.die(`Unexpected command in mock spawner: ${standard.command}`)
  })

  return {
    commands,
    layer: Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
  }
}

describe('npm-registry cli', () => {
  test('whoami trims the returned username and forwards registry overrides', async () => {
    const spawner = makeSpawnerLayer()

    const result = await Effect.runPromise(
      whoami({
        registry: 'https://registry.example.test/',
      }).pipe(Effect.provide(spawner.layer)),
    )

    expect(result).toBe('octocat')
    expect(spawner.commands).toContainEqual([
      'whoami',
      '--registry',
      'https://registry.example.test/',
    ])
  })

  test('whoami fails for empty output and spawn errors', async () => {
    const spawner = makeSpawnerLayer()

    const emptyResult = await Effect.runPromise(
      whoami({
        registry: 'https://registry.example.test/empty',
      }).pipe(Effect.flip, Effect.provide(spawner.layer)),
    )

    expect(emptyResult).toBeInstanceOf(NpmCliError)
    expect(emptyResult.context.detail).toContain('returned empty')

    const failedResult = await Effect.runPromise(
      whoami({
        registry: 'https://registry.example.test/fail',
      }).pipe(Effect.flip, Effect.provide(spawner.layer)),
    )

    expect(failedResult).toBeInstanceOf(NpmCliError)
    expect(failedResult.context.detail).toContain("Run 'npm login'")
  })

  test('pack returns the tarball path emitted by npm', async () => {
    const spawner = makeSpawnerLayer()

    const result = await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/react/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
      }).pipe(Effect.provide(spawner.layer)),
    )

    expect(Fs.Path.toString(result.tarball)).toBe('/repo/.release/artifacts/react-19.2.0.tgz')
    expect(result.filename).toBe('react-19.2.0.tgz')
    expect(spawner.commands).toContainEqual([
      'pack',
      '--json',
      '--pack-destination',
      '/repo/.release/artifacts/',
    ])
  })

  test('pack maps invalid JSON and empty pack metadata to NpmCliError', async () => {
    const invalidJson = await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/invalid-json/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(invalidJson).toBeInstanceOf(NpmCliError)
    expect(invalidJson.context.detail).toContain('unexpected JSON output')

    const emptyOutput = await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/empty/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(emptyOutput).toBeInstanceOf(NpmCliError)
    expect(emptyOutput.context.detail).toContain('no tarball metadata')
  })

  test('publish accepts a prepared tarball path', async () => {
    const spawner = makeSpawnerLayer()

    await Effect.runPromise(
      publish({
        tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/react-19.2.0.tgz'),
        tag: 'next',
        registry: 'https://registry.example.test/',
        access: 'public',
        ignoreScripts: false,
      }).pipe(Effect.provide(spawner.layer)),
    )

    expect(spawner.commands).toContainEqual([
      'publish',
      '/repo/.release/artifacts/react-19.2.0.tgz',
      '--access',
      'public',
      '--tag',
      'next',
      '--registry',
      'https://registry.example.test/',
    ])
  })

  test('publish maps non-zero exits and spawner failures to NpmCliError', async () => {
    const exitError = await Effect.runPromise(
      publish({
        tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/fail-exit.tgz'),
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(exitError).toBeInstanceOf(NpmCliError)
    expect(exitError.context.detail).toContain('exited with code 1')

    const spawnError = await Effect.runPromise(
      publish({
        tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/fail-spawn.tgz'),
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(spawnError).toBeInstanceOf(NpmCliError)
    expect(spawnError.context.operation).toBe('publish')
  })

  test('hasVersion returns true when npm view finds the exact version', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '19.2.0').pipe(Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result).toBe(true)
  })

  test('hasVersion returns false for npm E404 responses', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '0.0.0-nope').pipe(Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result).toBe(false)
  })

  test('hasVersion fails for non-404 npm view errors', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '18.3.1').pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result).toBeInstanceOf(NpmCliError)
    expect(result.context.detail).toContain('rate limited')
  })

  test('hasVersion falls back to exit-code detail when npm emits no structured error payload', async () => {
    const result = await Effect.runPromise(
      hasVersion('react', '17.0.0', {
        registry: 'https://registry.example.test/',
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result).toBeInstanceOf(NpmCliError)
    expect(result.context.detail).toContain('exited with code 1')
  })
})
