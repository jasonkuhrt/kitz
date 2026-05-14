import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { sha256Bytes } from './digest.js'
import { makeManifestFromPrepared, readManifest, writeManifest } from './artifact.js'
import { OfficialFirst } from './version/models/official-first.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'

const pkg = {
  name: Pkg.Moniker.parse('@kitz/core'),
  scope: 'core',
  path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
}

const tarball = Fs.Path.AbsFile.fromString('/repo/.release/artifacts/kitz-core-1.0.0.tgz')
const tarballBytes = new Uint8Array([1, 2, 3, 4])

const plan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-05-13T00:00:00.000Z',
  releases: [
    Official.make({
      package: pkg,
      version: OfficialFirst.make({
        version: Semver.fromString('1.0.0'),
        bump: 'major',
      }),
      commits: [makeCascadeCommit('core', 'feature')],
    }),
  ],
  cascades: [],
})

const artifact = {
  package: pkg,
  nextVersion: Semver.fromString('1.0.0'),
  tarball,
  packMetadata: {
    filename: 'kitz-core-1.0.0.tgz',
    tarball,
    files: [
      { path: 'package.json', size: 42 },
      { path: 'dist/index.js', size: 420 },
    ],
    size: tarballBytes.length,
    shasum: 'npm-sha1',
    integrity: 'sha512-npm',
  },
}

describe('artifact manifest', () => {
  test('records actual tarball bytes, packlist, and npm metadata from prepared artifacts', async () => {
    const manifests = await Effect.runPromise(
      makeManifestFromPrepared(plan, [artifact]).pipe(
        Effect.provide(Fs.Memory.layer({ [Fs.Path.toString(tarball)]: tarballBytes })),
      ),
    )

    expect(manifests).toHaveLength(1)
    expect(manifests[0]?.sha256).toEqual(sha256Bytes(tarballBytes))
    expect(manifests[0]?.sizeBytes).toBe(4)
    expect(manifests[0]?.packlist.map((path) => Fs.Path.toString(path))).toEqual([
      './package.json',
      './dist/index.js',
    ])
    expect(manifests[0]?.npmRegistryIntegrity).toBe('sha512-npm')
    expect(manifests[0]?.npmRegistryShasum).toBe('npm-sha1')
  })

  test('writes and reads the plan-bound manifest path', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const manifests = yield* makeManifestFromPrepared(plan, [artifact])
        yield* writeManifest(plan, manifests)
        return yield* readManifest(plan)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({ [Fs.Path.toString(tarball)]: tarballBytes }),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result)).toBe(true)
    if (Option.isNone(result)) {
      throw new Error('expected artifact manifest')
    }
    expect(result.value[0]?.packageName.moniker).toBe('@kitz/core')
  })
})
