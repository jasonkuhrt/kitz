import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import { describe, expect } from 'bun:test'
import { Effect, type FileSystem, type PlatformError } from 'effect'
import { FileSystemLayer } from '../platform.js'

const sourceRoot = Fs.Path.AbsDir.fromString(new URL('../', import.meta.url).pathname)
const sourceRootPath = sourceRoot.toString()

const forbiddenTimeReads = [
  {
    pattern: /\bnew\s+Date\s*\(\s*\)|\bDate\.now\s*\(\s*\)/gu,
    allowedIn: () => false,
  },
  {
    pattern:
      /\b(?:Clock|EffectClock)\.currentTimeMillis\b|import\s*\{[^}]*\bClock\b[^}]*\}\s*from\s*['"]effect['"]/gu,
    allowedIn: (file: string) => file === 'api/clock.ts',
  },
] as const

interface SourceFile {
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

          const name = entry.toString().slice(sourceRootPath.length)
          if (!name.endsWith('.ts') && !name.endsWith('.tsx')) return []
          if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) return []

          return [
            {
              name,
              source: yield* Fs.readString(entry),
            },
          ]
        }),
      ),
    )

    return groups.flat()
  })

const lineForIndex = (source: string, index: number): number =>
  source.slice(0, index).split('\n').length

describe('release time boundary', () => {
  Test.effect('production code reads wall-clock time through the release clock boundary', () =>
    Effect.gen(function* () {
      const offenders = (yield* sourceFiles(sourceRoot)).flatMap((file) =>
        forbiddenTimeReads.flatMap((read) =>
          read.allowedIn(file.name)
            ? []
            : [...file.source.matchAll(read.pattern)].map(
                (match) => `${file.name}:${lineForIndex(file.source, match.index)}: ${match[0]}`,
              ),
        ),
      )

      expect(offenders).toEqual([])
    }).pipe(Effect.provide(FileSystemLayer)),
  )
})
