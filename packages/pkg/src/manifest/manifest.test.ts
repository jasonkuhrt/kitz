import { Fs } from '@kitz/fs'
import { Effect, Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  Manifest,
  ManifestSchemaImmutable,
  emptyManifest,
  make,
  mergePackageScript,
  overwritePackageScript,
  parseMoniker,
  removePackageScript,
  resource,
  resourceMutable,
} from './manifest.js'

const manifestDir = Fs.Path.AbsDir.fromString('/repo/')
const manifestFile = Fs.Path.join(manifestDir, Fs.Path.RelFile.fromString('./package.json'))

describe('Pkg.Manifest', () => {
  test('decodes defaults and rich manifest fields', () => {
    const decoded = Schema.decodeSync(Manifest)({
      description: 'Package helpers',
      main: './build/index.js',
      type: 'module',
      scripts: { build: 'tsgo -b tsconfig.build.json' },
      dependencies: { effect: '^4.0.0' },
      devDependencies: { vitest: '^4.0.0' },
      peerDependencies: { '@kitz/core': 'workspace:*' },
      optionalDependencies: { fsevents: '^2.0.0' },
      bin: { pkg: './build/cli.js' },
      files: ['build'],
      exports: { '.': './src/_.ts' },
      imports: { '#pkg': './src/_.ts' },
      engines: { bun: '>=1.3.6', node: '>=20' },
      repository: { type: 'git', url: 'https://example.com/repo.git' },
      keywords: ['pkg'],
      author: { name: 'Jason', email: 'j@example.com', url: 'https://example.com' },
      license: 'MIT',
      bugs: { url: 'https://example.com/issues' },
      homepage: 'https://example.com',
      private: true,
      workspaces: { packages: ['packages/*'], nohoist: ['**/fixture'] },
      packageManager: 'bun@1.3.6',
      madge: { circular: false },
    })
    const created = make({ name: decoded.name, version: decoded.version })

    expect(decoded.name.moniker).toBe('unnamed')
    expect(decoded.version.toString()).toBe('0.0.0')
    expect(decoded.repository).toEqual({ type: 'git', url: 'https://example.com/repo.git' })
    expect(decoded.author).toEqual({
      name: 'Jason',
      email: 'j@example.com',
      url: 'https://example.com',
    })
    expect(decoded.toMutable()).toMatchObject({
      name: 'unnamed',
      version: '0.0.0',
      description: 'Package helpers',
      scripts: { build: 'tsgo -b tsconfig.build.json' },
      packageManager: 'bun@1.3.6',
    })
    expect(ManifestSchemaImmutable).toBe(Manifest)
    expect(created.toMutable()).toEqual({ name: 'unnamed', version: '0.0.0' })
  })

  test('script helpers mutate package scripts safely', () => {
    const manifest = emptyManifest.toMutable()

    removePackageScript(manifest, 'missing')

    overwritePackageScript(manifest, 'build', 'bun run build')
    mergePackageScript(manifest, 'build', 'bun run lint')
    mergePackageScript(manifest, 'build', 'bun run lint')
    expect(manifest.scripts?.['build']).toBe('bun run build && bun run lint')

    removePackageScript(manifest, 'build', 'bun run build')
    expect(manifest.scripts?.['build']).toBe('bun run lint')

    mergePackageScript(manifest, 'build', 'bun run test')
    expect(manifest.scripts?.['build']).toBe('bun run lint && bun run test')

    removePackageScript(manifest, 'build', 'bun run test')
    expect(manifest.scripts?.['build']).toBe('bun run lint')

    removePackageScript(manifest, 'build', 'bun run lint')
    expect(manifest.scripts).toEqual({})
  })

  test('parseMoniker splits scoped and unscoped package names', () => {
    expect(parseMoniker('@kitz/pkg')).toEqual({ org: '@kitz', name: 'pkg' })
    expect(parseMoniker('effect')).toEqual({ name: 'effect' })
    expect(parseMoniker('@kitz/pkg/extra')).toEqual({ name: '@kitz/pkg/extra' })
  })

  test('resource and resourceMutable preserve excess properties across round trips', async () => {
    const initialManifest = JSON.stringify(
      {
        name: '@kitz/pkg',
        version: '1.2.3',
        scripts: { build: 'tsgo -b' },
        trustedDependencies: ['esbuild'],
        packageManager: 'bun@1.3.6',
      },
      null,
      2,
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const readOption = yield* resourceMutable.read(manifestDir)
        const mutable = yield* resourceMutable.readRequired(manifestDir)

        overwritePackageScript(mutable, 'build', 'tsgo -b')
        mergePackageScript(mutable, 'build', 'bun run test')
        yield* resourceMutable.write(mutable, manifestDir)

        const afterWrite = yield* resource.readRequired(manifestDir)
        const fileAfterWrite = yield* Fs.readString(manifestFile)

        const updated = yield* resourceMutable.update(manifestDir, (current) => {
          removePackageScript(current, 'build', 'tsgo -b')
          current.private = true
          return current
        })

        yield* resourceMutable.delete(manifestDir)
        const empty = yield* resourceMutable.readOrEmpty(manifestDir)

        return { readOption, afterWrite, fileAfterWrite, updated, empty }
      }).pipe(Effect.provide(Fs.Memory.layer({ '/repo/package.json': initialManifest }))),
    )

    expect(Option.isSome(result.readOption)).toBe(true)
    expect(result.afterWrite.scripts).toEqual({ build: 'tsgo -b && bun run test' })
    expect(JSON.parse(result.fileAfterWrite)).toMatchObject({
      scripts: { build: 'tsgo -b && bun run test' },
    })
    expect(result.updated.scripts).toEqual({ build: 'bun run test' })
    expect(result.updated.private).toBe(true)
    expect(result.empty).toEqual({ name: 'unnamed', version: '0.0.0' })
  })
})
