import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { NpmRegistry } from './_.js'
import * as NpmCliTest from './test.js'

const { NpmCli, NpmCliError } = NpmRegistry

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect as Effect.Effect<A>)
const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect)

describe('NpmCli test service — happy-path defaults', () => {
  test('make() provides a driver with all methods scripted to succeed', async () => {
    const npm = NpmCliTest.make()

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      const user = yield* cli.whoami()
      const exists = yield* cli.hasVersion('@kitz/git', '1.0.0')
      const status = yield* cli.getAccessStatus('@kitz/git')
      return { user, exists, status }
    })

    const result = await run(program.pipe(Effect.provide(npm.$test.layer())))
    expect(result.user).toBe('dry-run-user')
    expect(result.exists).toBe(true)
    expect(result.status).toBe('public')
  })

  test('config overrides whoami default', async () => {
    const npm = NpmCliTest.make({ whoamiUser: 'alice' })

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      return yield* cli.whoami()
    })

    expect(await run(program.pipe(Effect.provide(npm.$test.layer())))).toBe('alice')
  })

  test('pack returns a usable PackResult, publish succeeds', async () => {
    const npm = NpmCliTest.make()

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      const packed = yield* cli.pack({
        cwd: Fs.Path.AbsDir.fromString('/repo/packages/git/'),
        packDestination: Fs.Path.AbsDir.fromString('/repo/.artifacts/'),
      })
      yield* cli.publish({ tarball: packed.tarball, access: 'public' })
      return packed.filename
    })

    const exit = await runExit(program.pipe(Effect.provide(npm.$test.layer())))
    expect(exit._tag).toBe('Success')
  })
})

describe('NpmCli test service — failure injection without re-stubbing', () => {
  test('inject a whoami failure on the happy-path driver', async () => {
    const npm = NpmCliTest.make()
    npm.whoami.everyFail(
      new NpmCliError({
        context: { operation: 'whoami', detail: 'not logged in' },
        cause: new Error('not logged in'),
      }),
    )

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      return yield* cli.whoami()
    })

    const exit = await runExit(program.pipe(Effect.provide(npm.$test.layer())))
    expect(exit._tag).toBe('Failure')
  })

  test('other methods still succeed after whoami is set to fail', async () => {
    const npm = NpmCliTest.make()
    npm.whoami.everyFail(
      new NpmCliError({ context: { operation: 'whoami' }, cause: new Error('x') }),
    )

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      return yield* cli.hasVersion('@kitz/git', '1.0.0')
    })

    expect(await run(program.pipe(Effect.provide(npm.$test.layer())))).toBe(true)
  })

  test('inject a per-version hasVersion result with when()', async () => {
    const npm = NpmCliTest.make()
    npm.hasVersion.when(['@kitz/git', '9.9.9']).everySuccess(false)

    const program = (name: string, version: string) =>
      Effect.gen(function* () {
        const cli = yield* NpmCli
        return yield* cli.hasVersion(name, version)
      }).pipe(Effect.provide(npm.$test.layer()))

    expect(await run(program('@kitz/git', '9.9.9'))).toBe(false)
    expect(await run(program('@kitz/git', '1.0.0'))).toBe(true)
  })
})

describe('NpmCli test service — call inspection', () => {
  test('records publish calls', async () => {
    const npm = NpmCliTest.make()
    const tarball = Fs.Path.AbsFile.fromString('/repo/.artifacts/pkg-1.0.0.tgz')

    const program = Effect.gen(function* () {
      const cli = yield* NpmCli
      yield* cli.publish({ tarball, access: 'public' })
    })

    await run(program.pipe(Effect.provide(npm.$test.layer())))

    expect(npm.publish.calls).toEqual([[{ tarball, access: 'public' }]])
  })
})
