import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, FileSystem } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import { Platform } from '@kitz/platform'
import * as ModModule from './_.js'
import {
  dynamicImportFile,
  type DynamicImportFileOptions,
  ImportErrorNotFound,
  ImportErrorOther,
  ImportErrorPackageConfig,
  ImportErrorPermissionDenied,
  ImportErrorSyntax,
  ImportErrorUnsupportedFormat,
  importDefault,
} from './import.js'

const fixturesDir = fileURLToPath(new URL('./__fixtures/', import.meta.url))

const withTempDir = async <A>(run: (dir: string) => Promise<A> | A): Promise<A> => {
  const dir = mkdtempSync(path.join(fixturesDir, 'runtime-'))

  try {
    return await run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const toAbsFile = (dir: string, fileName: string) =>
  Fs.Path.AbsFile.fromString(path.join(dir, fileName))

describe('mod', () => {
  test('exports the Mod namespace', () => {
    expect(ModModule.Mod.dynamicImportFile).toBe(dynamicImportFile)
    expect(ModModule.Mod.importDefault).toBe(importDefault)
  })

  test('imports default and named exports from local modules', async () => {
    const imported = await Effect.runPromise(
      dynamicImportFile<
        { default: { name: string }; helper: () => string },
        DynamicImportFileOptions
      >(Fs.Path.AbsFile.fromString('/tmp/sample.mjs'), {
        importFn: async () => ({
          default: { name: 'sample' },
          helper: () => 'helper',
        }),
      }),
    )

    expect(imported.default).toEqual({ name: 'sample' })
    expect(imported.helper()).toBe('helper')
  })

  test('uses native dynamic import when no custom import function is provided', async () => {
    const imported = await withTempDir(async (dir) => {
      const diskPath = path.join(dir, 'native.mjs')
      writeFileSync(diskPath, `export const answer = 42\nexport default { source: 'native' }\n`)

      return Effect.runPromise(
        dynamicImportFile<{ default: { source: string }; answer: number }>(
          Fs.Path.AbsFile.fromString(diskPath),
        ),
      )
    })

    expect(imported.default).toEqual({ source: 'native' })
    expect(imported.answer).toBe(42)
  })

  test('busts the native ESM cache when requested', async () => {
    const result = await withTempDir(async (dir) => {
      const modulePath = toAbsFile(dir, 'cached.mjs')
      const seen: string[] = []
      let statCallCount = 0
      const baseFileSystem = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* FileSystem.FileSystem
        }).pipe(Effect.provide(Platform.FileSystem.layer)),
      )
      const fileSystem: FileSystem.FileSystem = {
        ...baseFileSystem,
        stat: () =>
          Effect.succeed<FileSystem.File.Info>({
            type: 'File',
            mtime: { getTime: () => [1000, 2000][statCallCount++] ?? 2000 } as Date,
            atime: undefined,
            birthtime: undefined,
            dev: 0,
            ino: undefined,
            mode: 0,
            nlink: undefined,
            uid: undefined,
            gid: undefined,
            rdev: undefined,
            size: FileSystem.Size(0n),
            blksize: undefined,
            blocks: undefined,
          }),
      }

      const first = await Effect.runPromise(
        importDefault<string, DynamicImportFileOptions & { bustCache: true }>(modulePath, {
          bustCache: true,
          importFn: async (url: string) => {
            seen.push(url)
            return { default: new URL(url).searchParams.get('t') ?? 'missing' }
          },
        }).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem)),
      )

      const second = await Effect.runPromise(
        importDefault<string, DynamicImportFileOptions & { bustCache: true }>(modulePath, {
          bustCache: true,
          importFn: async (url: string) => {
            seen.push(url)
            return { default: new URL(url).searchParams.get('t') ?? 'missing' }
          },
        }).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem)),
      )

      return { first, second, seen }
    })

    expect(result.first).not.toBe('missing')
    expect(result.second).not.toBe('missing')
    expect(result.first).not.toBe(result.second)
    expect(result.seen).toHaveLength(2)
  })

  test('maps importer failures to typed import errors', async () => {
    const modulePath = Fs.Path.AbsFile.fromString('/tmp/failing-import.mjs')
    const missing = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw Object.assign(new Error('missing'), {
            code: 'ERR_MODULE_NOT_FOUND',
          })
        },
      }).pipe(Effect.flip),
    )
    const syntax = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw new SyntaxError('bad syntax')
        },
      }).pipe(Effect.flip),
    )
    const unsupported = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw Object.assign(new Error('unknown extension'), {
            code: 'ERR_UNKNOWN_FILE_EXTENSION',
          })
        },
      }).pipe(Effect.flip),
    )

    expect(missing).toBeInstanceOf(ImportErrorNotFound)
    expect(missing.message).toContain('/tmp/failing-import.mjs')
    expect(syntax).toBeInstanceOf(ImportErrorSyntax)
    expect(syntax.message).toContain('/tmp/failing-import.mjs')
    expect(unsupported).toBeInstanceOf(ImportErrorUnsupportedFormat)
    expect(unsupported.message).toContain('/tmp/failing-import.mjs')
  })

  test('maps custom importer failures to package, permission, and generic errors', async () => {
    const modulePath = Fs.Path.AbsFile.fromString('/tmp/custom-import.mjs')
    const packageConfig = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw Object.assign(new Error('bad package config'), {
            code: 'ERR_INVALID_PACKAGE_CONFIG',
          })
        },
      }).pipe(Effect.flip),
    )
    const permissionDenied = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw Object.assign(new Error('permission denied'), {
            code: 'EACCES',
          })
        },
      }).pipe(Effect.flip),
    )
    const generic = await Effect.runPromise(
      dynamicImportFile(modulePath, {
        importFn: async () => {
          throw 'boom'
        },
      }).pipe(Effect.flip),
    )

    expect(packageConfig).toBeInstanceOf(ImportErrorPackageConfig)
    expect(packageConfig.message).toContain('ERR_INVALID_PACKAGE_CONFIG')
    expect(permissionDenied).toBeInstanceOf(ImportErrorPermissionDenied)
    expect(permissionDenied.message).toContain('/tmp/custom-import.mjs')
    expect(generic).toBeInstanceOf(ImportErrorOther)
    expect(generic.message).toContain('/tmp/custom-import.mjs')
  })

  test('maps unsupported extension errors with extension context', async () => {
    const unsupported = await Effect.runPromise(
      dynamicImportFile(Fs.Path.AbsFile.fromString('/tmp/file.notes.txt'), {
        importFn: async () => {
          throw Object.assign(new Error('unknown extension'), {
            code: 'ERR_UNKNOWN_FILE_EXTENSION',
          })
        },
      }).pipe(Effect.flip),
    )

    expect(unsupported).toBeInstanceOf(ImportErrorUnsupportedFormat)
    expect(unsupported.message).toContain('.txt')
  })
})
