import { createHash } from 'node:crypto'
import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Ref } from 'effect'
import { NpmRegistry } from './_.js'
import * as Memory from './memory.js'
import * as Tarball from './tarball.js'

const { NpmCli, NpmCliError } = NpmRegistry

const coreDir = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const artifacts = Fs.Path.AbsDir.fromString('/repo/.release/artifacts/')

const disk: Fs.Memory.DiskLayout = {
  '/repo/packages/core/package.json': JSON.stringify({ name: '@kitz/core', version: '1.1.0' }),
  '/repo/packages/cli/package.json': JSON.stringify({ name: '@kitz/cli', version: '2.0.0' }),
}

interface Harness {
  readonly layer: Layer.Layer<NpmRegistry.NpmCli>
  readonly state: Memory.NpmCliMemoryState
}

const makeHarness = async (config: Memory.NpmCliMemoryConfig = {}): Promise<Harness> => {
  const { layer, state } = await Effect.runPromise(Memory.makeWithState(config))
  return { layer: layer.pipe(Layer.provide(Fs.Memory.layer(disk))), state }
}

const run = <A, E>(harness: Harness, effect: Effect.Effect<A, E, NpmRegistry.NpmCli>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(harness.layer)) as Effect.Effect<A>)

const get = <A>(ref: Ref.Ref<A>): Promise<A> => Effect.runPromise(Ref.get(ref))

const packCore = Effect.gen(function* () {
  const npm = yield* NpmCli
  return yield* npm.pack({ cwd: coreDir, packDestination: artifacts })
})

const packAndPublishCore = (publishOverrides: { tag?: string; dryRun?: boolean } = {}) =>
  Effect.gen(function* () {
    const npm = yield* NpmCli
    const packed = yield* npm.pack({ cwd: coreDir, packDestination: artifacts })
    yield* npm.publish({ tarball: packed.tarball, ...publishOverrides })
    return packed
  })

const hasCoreVersion = Effect.gen(function* () {
  const npm = yield* NpmCli
  return yield* npm.hasVersion('@kitz/core', '1.1.0')
})

describe('Memory — pack', () => {
  test('reads the manifest, derives the tarball name, and records a receipt', async () => {
    const harness = await makeHarness()

    const packed = await run(harness, packCore)

    expect(packed.filename).toBe(Tarball.filename('@kitz/core', '1.1.0'))
    expect(Fs.Path.toString(packed.tarball)).toBe('/repo/.release/artifacts/kitz-core-1.1.0.tgz')

    const receipts = await get(harness.state.packReceipts)
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.packageName).toBe('@kitz/core')
    expect(receipts[0]!.version).toBe('1.1.0')
    expect(receipts[0]!.manifest['name']).toBe('@kitz/core')
  })

  test('fails typed when package.json cannot be read', async () => {
    const harness = await makeHarness()

    const error = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return yield* npm
          .pack({
            cwd: Fs.Path.AbsDir.fromString('/repo/packages/ghost/'),
            packDestination: artifacts,
          })
          .pipe(Effect.flip)
      }),
    )

    expect(error).toBeInstanceOf(NpmCliError)
    expect(error.context.operation).toBe('pack')
    expect(error.context.detail).toContain('failed to read')
  })

  test('failure injection fails typed and records no receipt', async () => {
    const harness = await makeHarness({ failPackPackages: ['@kitz/core'] })

    const error = await run(harness, packCore.pipe(Effect.flip))

    expect(error).toBeInstanceOf(NpmCliError)
    expect(error.context.operation).toBe('pack')
    expect(error.context.detail).toContain('injected')

    expect(await get(harness.state.packReceipts)).toHaveLength(0)
    // The attempt is still visible in the ordered call log.
    const calls = await get(harness.state.calls)
    expect(calls.map((call) => call.operation)).toEqual(['pack'])
  })
})

describe('Memory — publish', () => {
  test('registers version, dist-tag, and receipt; registry reads agree', async () => {
    const harness = await makeHarness()

    const observation = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        const packed = yield* packAndPublishCore({ tag: 'next' })
        const has = yield* npm.hasVersion('@kitz/core', '1.1.0')
        expect(has).toBe(true)
        return yield* npm.observeVersion('@kitz/core', '1.1.0', { downloadTarball: true })
      }),
    )

    expect(await get(harness.state.published)).toEqual({ '@kitz/core': ['1.1.0'] })
    expect(await get(harness.state.distTags)).toEqual({ '@kitz/core': { next: '1.1.0' } })

    const receipts = await get(harness.state.publishReceipts)
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.packageName).toBe('@kitz/core')
    expect(receipts[0]!.tag).toBe('next')

    expect(observation.distTags).toEqual({ next: '1.1.0' })
    expect(observation.tarballUrl).toBe(
      'https://registry.npmjs.org/@kitz/core/-/kitz-core-1.1.0.tgz',
    )
    const expectedSha = createHash('sha256')
      .update(new TextEncoder().encode('packed:@kitz/core@1.1.0'))
      .digest('hex')
    expect(observation.downloadedTarballSha256).toBe(expectedSha)
  })

  test('defaults the dist-tag to latest', async () => {
    const harness = await makeHarness()

    await run(harness, packAndPublishCore())

    expect(await get(harness.state.distTags)).toEqual({ '@kitz/core': { latest: '1.1.0' } })
  })

  test('dry run records the call but does not mutate the registry', async () => {
    const harness = await makeHarness()

    const has = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        yield* packAndPublishCore({ dryRun: true })
        return yield* npm.hasVersion('@kitz/core', '1.1.0')
      }),
    )

    expect(has).toBe(false)
    expect(await get(harness.state.publishReceipts)).toHaveLength(0)
    expect(await get(harness.state.published)).toEqual({})

    const calls = await get(harness.state.calls)
    expect(calls.map((call) => call.operation)).toEqual(['pack', 'publish', 'hasVersion'])
  })

  test('failure injection fails typed and leaves the registry untouched', async () => {
    const harness = await makeHarness({ failPublishPackages: ['@kitz/core'] })

    const error = await run(harness, packAndPublishCore().pipe(Effect.flip))

    expect(error).toBeInstanceOf(NpmCliError)
    expect(error.context.operation).toBe('publish')
    expect(error.context.detail).toContain('injected')

    expect(await get(harness.state.publishReceipts)).toHaveLength(0)
    expect(await get(harness.state.published)).toEqual({})
    expect(await run(harness, hasCoreVersion)).toBe(false)
  })

  test('failure injection matches unpacked tarballs by slug', async () => {
    const harness = await makeHarness({ failPublishPackages: ['@kitz/core'] })

    const error = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return yield* npm
          .publish({ tarball: Fs.Path.AbsFile.fromString('/elsewhere/kitz-core-9.9.9.tgz') })
          .pipe(Effect.flip)
      }),
    )

    expect(error).toBeInstanceOf(NpmCliError)
    expect(error.context.operation).toBe('publish')
  })

  test('failure injection can be cleared mid-run through state', async () => {
    const harness = await makeHarness({ failPublishPackages: ['@kitz/core'] })

    await run(harness, packAndPublishCore().pipe(Effect.flip))
    await Effect.runPromise(Ref.set(harness.state.failPublishPackages, []))
    await run(harness, packAndPublishCore())

    expect(await get(harness.state.published)).toEqual({ '@kitz/core': ['1.1.0'] })
  })
})

describe('Memory — registry reads', () => {
  test('seeded versions answer hasVersion and observeVersion without receipts', async () => {
    const harness = await makeHarness({
      published: { '@kitz/core': ['1.0.0'] },
      distTags: { '@kitz/core': { latest: '1.0.0' } },
    })

    const result = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        const seeded = yield* npm.hasVersion('@kitz/core', '1.0.0')
        const unseeded = yield* npm.hasVersion('@kitz/core', '1.1.0')
        const observation = yield* npm.observeVersion('@kitz/core', '1.0.0', {
          downloadTarball: true,
        })
        return { seeded, unseeded, observation }
      }),
    )

    expect(result.seeded).toBe(true)
    expect(result.unseeded).toBe(false)
    expect(result.observation.distTags).toEqual({ latest: '1.0.0' })
    // Seeded versions have no tarball bytes to hash.
    expect(result.observation.downloadedTarballSha256).toBeUndefined()
  })

  test('missingVersions hides a version even after a successful publish', async () => {
    const harness = await makeHarness({ missingVersions: ['@kitz/core@1.1.0'] })

    const result = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        yield* packAndPublishCore()
        const has = yield* npm.hasVersion('@kitz/core', '1.1.0')
        const error = yield* npm.observeVersion('@kitz/core', '1.1.0').pipe(Effect.flip)
        return { has, error }
      }),
    )

    expect(result.has).toBe(false)
    expect(result.error).toBeInstanceOf(NpmCliError)
    expect(result.error.context.detail).toContain('does not show')
  })

  test('observeVersion fails when nothing was published', async () => {
    const harness = await makeHarness()

    const error = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return yield* npm.observeVersion('@kitz/core', '1.1.0').pipe(Effect.flip)
      }),
    )

    expect(error).toBeInstanceOf(NpmCliError)
    expect(error.context.operation).toBe('view')
    expect(error.context.detail).toContain('no publish receipt')
  })

  test('observeVersion derives tarballUrl from the registry override', async () => {
    const harness = await makeHarness()

    const observation = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        yield* packAndPublishCore()
        return yield* npm.observeVersion('@kitz/core', '1.1.0', {
          registry: 'https://registry.example.test/',
        })
      }),
    )

    expect(observation.tarballUrl).toBe(
      'https://registry.example.test/@kitz/core/-/kitz-core-1.1.0.tgz',
    )
  })
})

describe('Memory — call recording and defaults', () => {
  test('records every call in invocation order', async () => {
    const harness = await makeHarness()

    await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        yield* npm.whoami()
        const packed = yield* npm.pack({ cwd: coreDir, packDestination: artifacts })
        yield* npm.publish({ tarball: packed.tarball })
        yield* npm.hasVersion('@kitz/core', '1.1.0')
        yield* npm.getAccessStatus('@kitz/core')
        yield* npm.listAccessPackages('kitz')
        yield* npm.listAccessCollaborators('@kitz/core')
        yield* npm.observeVersion('@kitz/core', '1.1.0')
      }),
    )

    const calls = await get(harness.state.calls)
    expect(calls.map((call) => call.operation)).toEqual([
      'whoami',
      'pack',
      'publish',
      'hasVersion',
      'getAccessStatus',
      'listAccessPackages',
      'listAccessCollaborators',
      'observeVersion',
    ])
  })

  test('defaults: user, access status, and access listings', async () => {
    const harness = await makeHarness()

    const result = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return {
          user: yield* npm.whoami(),
          status: yield* npm.getAccessStatus('@kitz/core'),
          packages: yield* npm.listAccessPackages('kitz'),
          collaborators: yield* npm.listAccessCollaborators('@kitz/core'),
        }
      }),
    )

    expect(result.user).toBe('memory-user')
    expect(result.status).toBe('public')
    expect(result.packages).toEqual({})
    expect(result.collaborators).toEqual({})
  })

  test('config overrides user and access values', async () => {
    const harness = await makeHarness({
      user: 'alice',
      accessStatus: 'restricted',
      accessPackages: { '@kitz/core': 'read-write' },
    })

    const result = await run(
      harness,
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return {
          user: yield* npm.whoami(),
          status: yield* npm.getAccessStatus('@kitz/core'),
          packages: yield* npm.listAccessPackages('kitz'),
        }
      }),
    )

    expect(result.user).toBe('alice')
    expect(result.status).toBe('restricted')
    expect(result.packages).toEqual({ '@kitz/core': 'read-write' })
  })

  test('make() provides a working layer without a state handle', async () => {
    const layer = Memory.make({ published: { '@kitz/core': ['1.0.0'] } }).pipe(
      Layer.provide(Fs.Memory.layer(disk)),
    )

    const has = await Effect.runPromise(
      Effect.gen(function* () {
        const npm = yield* NpmCli
        return yield* npm.hasVersion('@kitz/core', '1.0.0')
      }).pipe(Effect.provide(layer)) as Effect.Effect<boolean>,
    )

    expect(has).toBe(true)
  })
})
