import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import { describe, expect } from 'bun:test'
import { Effect, type FileSystem, type PlatformError } from 'effect'
import { FileSystemLayer } from '../../platform.js'

const publishingRoot = Fs.Path.AbsDir.fromString(new URL('./', import.meta.url).pathname)
const publishingRootPath = publishingRoot.toString()

interface SourceFile {
  readonly path: Fs.Path.AbsFile
  readonly name: string
  readonly source: string
}

const sourceFiles = (
  dir: Fs.Path.AbsDir,
): Effect.Effect<readonly SourceFile[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const entries = yield* Fs.read(dir)
    const groups = yield* Effect.all(
      entries.map((entry) =>
        Effect.gen(function* () {
          if (Fs.Path.AbsDir.is(entry)) return yield* sourceFiles(entry)
          if (!Fs.Path.AbsFile.is(entry)) return []

          const name = entry.toString().slice(publishingRootPath.length)
          if (!name.endsWith('.ts')) return []
          if (name.endsWith('.test.ts')) return []

          return [
            {
              path: entry,
              name,
              source: yield* Fs.readString(entry),
            },
          ]
        }),
      ),
    )

    return groups.flat()
  })

describe('publishing module boundary', () => {
  Test.effect('publishing keeps concrete providers without dormant Context service shells', () =>
    Effect.gen(function* () {
      const serviceShells = (yield* sourceFiles(publishingRoot))
        .filter((file) => file.source.includes('Context.Service'))
        .map((file) => file.name)

      expect(serviceShells).toEqual([])
    }).pipe(Effect.provide(FileSystemLayer)),
  )

  Test.effect('publishing barrel exports concrete capability surfaces only', () =>
    Effect.gen(function* () {
      const barrel = yield* Fs.readString(
        Fs.Path.join(publishingRoot, Fs.Path.RelFile.fromString('./__.ts')),
      )
      const files = yield* sourceFiles(publishingRoot)
      const serviceOnlyModules = [
        'artifacter',
        'credentials',
        'package-manager',
        'package-registry',
        'release-manager',
        'requests',
        'results',
      ]

      expect(
        serviceOnlyModules.filter(
          (module) => barrel.includes(`'./${module}.js'`) || barrel.includes(`"./${module}.js"`),
        ),
      ).toEqual([])
      expect(files.map((file) => file.path.name)).toContain('conformance.ts')
    }).pipe(Effect.provide(FileSystemLayer)),
  )
})
