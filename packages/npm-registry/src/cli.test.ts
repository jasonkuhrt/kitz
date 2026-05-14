import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Fs } from '@kitz/fs'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  NpmCliError,
  getAccessStatus,
  hasVersion,
  listAccessCollaborators,
  listAccessPackages,
  observeVersion,
  pack,
  publish,
  whoami,
} from './cli.js'

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

const makeSpawnerLayer = (options?: { readonly notFoundTarballUrl?: string }) => {
  const commands: string[][] = []
  const commandOptions: ChildProcess.StandardCommand['options'][] = []
  const spawner = ChildProcessSpawner.make((command) => {
    const standard = ChildProcess.isStandardCommand(command) ? command : undefined
    if (!standard) {
      return Effect.die('Unexpected piped command in mock spawner') as any
    }

    const args = standard.args
    const cwd = standard.options?.cwd
    commands.push(args ? [...args] : [])
    commandOptions.push(standard.options)

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

      if (spec === 'react' && args?.[3] === 'dist-tags') {
        return Effect.succeed(
          makeHandle(JSON.stringify({ latest: '19.2.0', next: '20.0.0-beta.1' }) + '\n', 0),
        )
      }

      if (spec === 'react@19.2.0' && args?.[3] === 'version') {
        return Effect.succeed(makeHandle('"19.2.0"\n', 0))
      }

      if (spec === 'react@19.2.0') {
        return Effect.succeed(
          makeHandle(
            JSON.stringify({
              name: 'react',
              version: '19.2.0',
              dist: {
                tarball: 'https://registry.example.test/react/-/react-19.2.0.tgz',
                shasum: 'sha1-registry',
                integrity: 'sha512-registry',
              },
            }) + '\n',
            0,
          ),
        )
      }

      if (spec === 'react@19.2.1') {
        return Effect.succeed(
          makeHandle(
            JSON.stringify({
              name: 'react',
              version: '19.2.1',
              dist: {
                tarball: 'data:application/octet-stream;base64,AQID',
                shasum: 'sha1-registry',
                integrity: 'sha512-registry',
              },
            }) + '\n',
            0,
          ),
        )
      }

      if (spec === 'react@19.2.2') {
        return Effect.succeed(
          makeHandle(
            JSON.stringify({
              name: 'react',
              version: '19.2.2',
              dist: {
                tarball: 'http://%',
              },
            }) + '\n',
            0,
          ),
        )
      }

      if (spec === 'react@19.2.3') {
        return Effect.succeed(
          makeHandle(
            JSON.stringify({
              name: 'react',
              version: '19.2.3',
              dist: {
                tarball: options?.notFoundTarballUrl ?? 'data:application/octet-stream;base64,AQID',
              },
            }) + '\n',
            0,
          ),
        )
      }

      if (spec === 'react@bad-json') {
        return Effect.succeed(makeHandle('{not json}\n', 0))
      }

      if (spec === 'react@view-fail') {
        return Effect.succeed(
          makeHandle(
            JSON.stringify({
              error: {
                code: 'E500',
                summary: 'registry unavailable',
              },
            }) + '\n',
            1,
          ),
        )
      }

      if (spec === 'react@spawn-view') {
        return Effect.fail(new Error('spawn failed'))
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
      if (cwd?.startsWith('/repo/packages/fail-spawn')) {
        return Effect.fail(new Error('spawn failed'))
      }

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

    // npm access
    if (args?.[0] === 'access') {
      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'octocat') {
        return Effect.succeed(
          makeHandle(JSON.stringify({ react: 'read-write', '@scope/pkg': 'read-only' }) + '\n', 0),
        )
      }

      if (args[1] === 'list' && args[2] === 'collaborators' && args[3] === 'react') {
        return Effect.succeed(
          makeHandle(JSON.stringify({ octocat: 'read-write', hubot: 'read-only' }) + '\n', 0),
        )
      }

      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'bad-json') {
        return Effect.succeed(makeHandle('{not json}\n', 0))
      }

      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'access-fail') {
        return Effect.succeed(
          makeHandle(JSON.stringify({ error: { code: 'E403', summary: 'forbidden' } }) + '\n', 1),
        )
      }

      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'access-empty-fail') {
        return Effect.succeed(makeHandle('', 1))
      }

      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'spawn-access') {
        return Effect.fail(new Error('spawn failed'))
      }

      if (args[1] === 'list' && args[2] === 'packages' && args[3] === 'spawn-access-string') {
        return Effect.fail('spawn failed' as any)
      }

      if (args[1] === 'get' && args[2] === 'status' && args[3] === 'react') {
        return Effect.succeed(makeHandle('"public"\n', 0))
      }

      if (args[1] === 'get' && args[2] === 'status' && args[3] === '@scope/pkg') {
        return Effect.succeed(makeHandle(JSON.stringify({ status: 'restricted' }) + '\n', 0))
      }

      if (args[1] === 'get' && args[2] === 'status' && args[3] === 'unknown-shape') {
        return Effect.succeed(makeHandle(JSON.stringify({ status: 'internal' }) + '\n', 0))
      }

      if (args[1] === 'get' && args[2] === 'status' && args[3] === 'bad-json') {
        return Effect.succeed(makeHandle('{not json}\n', 0))
      }

      if (args[1] === 'get' && args[2] === 'status' && args[3] === 'access-fail') {
        return Effect.succeed(
          makeHandle(JSON.stringify({ error: { code: 'E403', summary: 'forbidden' } }) + '\n', 1),
        )
      }

      return Effect.die(`Unexpected npm access args: ${args.join(' ')}`)
    }

    return Effect.die(`Unexpected command in mock spawner: ${standard.command}`)
  })

  return {
    commands,
    commandOptions,
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
    expect(spawner.commandOptions.at(-1)).toMatchObject({
      cwd: '/repo/packages/react/',
    })
    expect(spawner.commands).toContainEqual([
      'pack',
      '--json',
      '--pack-destination',
      '/repo/.release/artifacts/',
    ])
  })

  test('pack can run with an explicitly bounded child environment', async () => {
    const spawner = makeSpawnerLayer()

    await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/react/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
        env: {
          PATH: '/bin:/usr/bin',
          HOME: '/Users/test',
        },
      }).pipe(Effect.provide(spawner.layer)),
    )

    expect(spawner.commandOptions.at(-1)).toMatchObject({
      env: {
        PATH: '/bin:/usr/bin',
        HOME: '/Users/test',
      },
      extendEnv: false,
    })
  })

  test('pack maps invalid JSON and empty pack metadata to NpmCliError', async () => {
    const spawnError = await Effect.runPromise(
      pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/fail-spawn/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'),
      }).pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(spawnError).toBeInstanceOf(NpmCliError)
    expect(spawnError.context.detail).toContain('npm pack failed')

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
        dryRun: true,
        otp: '123456',
        provenance: true,
        provenanceFile: Fs.Path.AbsFile.fromString('/repo/provenance.jsonl'),
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
      '--otp',
      '123456',
      '--provenance',
      '--provenance-file',
      '/repo/provenance.jsonl',
      '--dry-run',
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

  test('access proofs expose package list, collaborators, and status commands', async () => {
    const spawner = makeSpawnerLayer()

    const packages = await Effect.runPromise(
      listAccessPackages('octocat', {
        registry: 'https://registry.example.test/',
      }).pipe(Effect.provide(spawner.layer)),
    )
    const collaborators = await Effect.runPromise(
      listAccessCollaborators('react').pipe(Effect.provide(spawner.layer)),
    )
    const publicStatus = await Effect.runPromise(
      getAccessStatus('react').pipe(Effect.provide(spawner.layer)),
    )
    const restrictedStatus = await Effect.runPromise(
      getAccessStatus('@scope/pkg').pipe(Effect.provide(spawner.layer)),
    )
    const unknownStatus = await Effect.runPromise(
      getAccessStatus('unknown-shape').pipe(Effect.provide(spawner.layer)),
    )

    expect(packages).toEqual({ react: 'read-write', '@scope/pkg': 'read-only' })
    expect(collaborators).toEqual({ octocat: 'read-write', hubot: 'read-only' })
    expect(publicStatus).toBe('public')
    expect(restrictedStatus).toBe('restricted')
    expect(unknownStatus).toBe('unknown')
    expect(spawner.commands).toContainEqual([
      'access',
      'list',
      'packages',
      'octocat',
      '--json',
      '--registry',
      'https://registry.example.test/',
    ])
  })

  test('access proof commands map invalid JSON and denied access to NpmCliError', async () => {
    const invalidStatus = await Effect.runPromise(
      getAccessStatus('bad-json').pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )
    const deniedStatus = await Effect.runPromise(
      getAccessStatus('access-fail').pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )
    const invalidList = await Effect.runPromise(
      listAccessPackages('bad-json').pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )
    const deniedList = await Effect.runPromise(
      listAccessPackages('access-fail').pipe(Effect.flip, Effect.provide(makeSpawnerLayer().layer)),
    )
    const emptyList = await Effect.runPromise(
      listAccessPackages('access-empty-fail').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )
    const spawnedList = await Effect.runPromise(
      listAccessPackages('spawn-access').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )
    const stringSpawnedList = await Effect.runPromise(
      listAccessPackages('spawn-access-string').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )

    expect(invalidStatus.context.detail).toContain('unexpected JSON output')
    expect(deniedStatus.context.detail).toContain('forbidden')
    expect(invalidList.context.detail).toContain('unexpected JSON output')
    expect(deniedList.context.detail).toContain('forbidden')
    expect(emptyList.context.detail).toContain('exited with code 1')
    expect(spawnedList.context.detail).toContain('spawn failed')
    expect(stringSpawnedList.context.detail).toContain('npm access failed')
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

  test('observeVersion reads version metadata and package dist-tags', async () => {
    const result = await Effect.runPromise(
      observeVersion('react', '19.2.0', {
        registry: 'https://registry.example.test/',
      }).pipe(Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result.distTags).toEqual({ latest: '19.2.0', next: '20.0.0-beta.1' })
    expect(result.tarballUrl).toBe('https://registry.example.test/react/-/react-19.2.0.tgz')
    expect(result.shasum).toBe('sha1-registry')
    expect(result.integrity).toBe('sha512-registry')
  })

  test('observeVersion can bind registry observations to downloaded tarball bytes', async () => {
    const result = await Effect.runPromise(
      observeVersion('react', '19.2.1', {
        downloadTarball: true,
      }).pipe(Effect.provide(makeSpawnerLayer().layer)),
    )

    expect(result.downloadedTarballSha256).toBeDefined()
  })

  test('observeVersion maps npm view and tarball download failures to NpmCliError', async () => {
    const notFoundServer = Bun.serve({
      port: 0,
      fetch: () => new Response('missing', { status: 404 }),
    })

    const invalidJson = await Effect.runPromise(
      observeVersion('react', 'bad-json').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )
    const viewFailure = await Effect.runPromise(
      observeVersion('react', 'view-fail').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )
    const downloadFailure = await Effect.runPromise(
      observeVersion('react', '19.2.2', { downloadTarball: true }).pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )
    const notFoundDownload = await Effect.runPromise(
      observeVersion('react', '19.2.3', { downloadTarball: true }).pipe(
        Effect.flip,
        Effect.provide(
          makeSpawnerLayer({
            notFoundTarballUrl: `http://127.0.0.1:${String(notFoundServer.port)}/missing.tgz`,
          }).layer,
        ),
      ),
    )
    const spawnFailure = await Effect.runPromise(
      observeVersion('react', 'spawn-view').pipe(
        Effect.flip,
        Effect.provide(makeSpawnerLayer().layer),
      ),
    )

    expect(invalidJson.context.detail).toContain('unexpected JSON output')
    expect(viewFailure.context.detail).toContain('registry unavailable')
    expect(downloadFailure.context.detail).toContain('fetch')
    expect(notFoundDownload.context.detail).toContain('HTTP 404')
    expect(spawnFailure.context.detail).toContain('spawn failed')
    await notFoundServer.stop(true)
  })
})
