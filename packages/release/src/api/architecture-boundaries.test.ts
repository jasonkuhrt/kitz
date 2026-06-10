import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import { describe, expect } from 'bun:test'
import { Effect, Schema, type FileSystem, type PlatformError } from 'effect'
import { FileSystemLayer } from '../platform.js'

const sourceRoot = Fs.Path.AbsDir.fromString(new URL('../', import.meta.url).pathname)
const packageRoot = Fs.Path.AbsDir.fromString(new URL('../../', import.meta.url).pathname)
const sourceRootPath = sourceRoot.toString()
const productionFile = (name: string) =>
  (name.endsWith('.ts') || name.endsWith('.tsx')) &&
  !name.endsWith('.test.ts') &&
  !name.endsWith('.test.tsx')

const forbiddenTimeReads = [
  { pattern: /\bnew\s+Date\s*\(\s*\)|\bDate\.now\s*\(\s*\)/gu, allowedIn: () => false },
  {
    pattern:
      /\b(?:Clock|EffectClock)\.currentTimeMillis\b|import\s*\{[^}]*\bClock\b[^}]*\}\s*from\s*['"]effect['"]/gu,
    allowedIn: (file: string) => file === 'api/clock.ts',
  },
] as const
const apiBarrelDependencyPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)?['"][^'"]*api\/__\.js['"]/gu

type SourceFile = { readonly name: string; readonly source: string }
const PackageManifest = Schema.Struct({
  exports: Schema.Record(Schema.String, Schema.String),
  imports: Schema.Record(Schema.String, Schema.Unknown),
})
const decodePackageManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(PackageManifest))

const sourceFiles = (
  dir: Fs.Path.AbsDir,
): Effect.Effect<readonly SourceFile[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const groups = yield* Effect.all(
      (yield* Fs.read(dir)).map((entry) =>
        Fs.Path.AbsDir.is(entry)
          ? sourceFiles(entry)
          : Fs.Path.AbsFile.is(entry)
            ? Effect.map(Fs.readString(entry), (source) => {
                const name = entry.toString().slice(sourceRootPath.length)
                return productionFile(name) ? [{ name, source }] : []
              })
            : Effect.succeed([]),
      ),
    )
    return groups.flat()
  })

const lineForIndex = (source: string, index: number): number =>
  source.slice(0, index).split('\n').length

const matches = (files: readonly SourceFile[], pattern: RegExp): readonly string[] =>
  files.flatMap((file) =>
    [...file.source.matchAll(pattern)].map(
      (match) => `${file.name}:${lineForIndex(file.source, match.index)}: ${match[0]}`,
    ),
  )

describe('release architecture boundaries', () => {
  Test.effect('production code reads wall-clock time through the release clock boundary', () =>
    Effect.gen(function* () {
      const files = yield* sourceFiles(sourceRoot)
      const offenders = forbiddenTimeReads.flatMap((read) =>
        matches(
          files.filter((file) => !read.allowedIn(file.name)),
          read.pattern,
        ),
      )
      expect(offenders).toEqual([])
    }).pipe(Effect.provide(FileSystemLayer)),
  )

  Test.effect('production code imports focused API modules instead of the public Api barrel', () =>
    Effect.gen(function* () {
      expect(matches(yield* sourceFiles(sourceRoot), apiBarrelDependencyPattern)).toEqual([])
    }).pipe(Effect.provide(FileSystemLayer)),
  )

  Test.effect('root release namespace exports without duplicate identifier suppression', () =>
    Effect.gen(function* () {
      const source = yield* Fs.readString(Fs.Path.join(sourceRoot, Fs.Path.fromString('./_.ts')))
      expect(source).not.toContain('@ts-expect-error Duplicate identifier')
    }).pipe(Effect.provide(FileSystemLayer)),
  )

  Test.effect('package manifest exposes a curated public surface, not the broad API barrel', () =>
    Effect.gen(function* () {
      const manifest = yield* Fs.readString(
        Fs.Path.join(packageRoot, Fs.Path.fromString('./package.json')),
      ).pipe(Effect.flatMap(decodePackageManifest))

      expect(manifest.exports).toEqual({
        '.': './src/__.ts',
        './__': './src/__.ts',
        './promise-api': './src/promise-api.ts',
      })
      expect(manifest.imports['#release']).toBe('./src/__.ts')
    }).pipe(Effect.provide(FileSystemLayer)),
  )
})
