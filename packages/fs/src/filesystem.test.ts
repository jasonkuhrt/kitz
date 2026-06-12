import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { Fs } from './_.js'

const srcDir = Fs.Path.AbsDir.fromString('/src/')
const destDir = Fs.Path.AbsDir.fromString('/dest/')

const layout = {
  '/src/package.json': '{"name":"@kitz/core"}',
  '/src/index.ts': 'export {}',
  '/src/.git/HEAD': 'ref: refs/heads/main',
  '/src/node_modules/dep/package.json': '{"name":"dep"}',
  '/src/lib/util.ts': 'export const util = 1',
  '/src/lib/node_modules/nested/package.json': '{"name":"nested"}',
}

const runCopy = (options?: Fs.CopyOptions) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* Fs.copy(srcDir, destDir, options)
      const checks = [
        '/dest/package.json',
        '/dest/index.ts',
        '/dest/.git/HEAD',
        '/dest/node_modules/dep/package.json',
        '/dest/lib/util.ts',
        '/dest/lib/node_modules/nested/package.json',
      ] as const
      const results: Record<string, boolean> = {}
      for (const path of checks) {
        results[path] = yield* Fs.exists(Fs.Path.AbsFile.fromString(path))
      }
      return results
    }).pipe(Effect.provide(Fs.Memory.layer(layout))),
  )

describe('Fs.copy with filter', () => {
  test('skips filtered entries at every depth, including their subtrees', async () => {
    const ignore = ['.git', 'node_modules']
    const results = await runCopy({ filter: (entry) => !ignore.includes(entry.name) })

    expect(results['/dest/package.json']).toBe(true)
    expect(results['/dest/index.ts']).toBe(true)
    expect(results['/dest/lib/util.ts']).toBe(true)
    // Ignored at the root
    expect(results['/dest/.git/HEAD']).toBe(false)
    expect(results['/dest/node_modules/dep/package.json']).toBe(false)
    // Ignored at depth
    expect(results['/dest/lib/node_modules/nested/package.json']).toBe(false)
  })

  test('copies everything when the filter accepts all entries', async () => {
    const results = await runCopy({ filter: () => true })

    for (const value of Object.values(results)) {
      expect(value).toBe(true)
    }
  })

  test('filter receives name, full source path, and entry type', async () => {
    const seen: Array<{ name: string; path: string; type: string }> = []

    await runCopy({
      filter: (entry) => {
        seen.push({ name: entry.name, path: entry.path, type: entry.type })
        return true
      },
    })

    expect(seen).toContainEqual({ name: 'lib', path: '/src/lib', type: 'directory' })
    expect(seen).toContainEqual({ name: 'util.ts', path: '/src/lib/util.ts', type: 'file' })
  })

  test('filtered copy preserves file contents', async () => {
    const content = await Effect.runPromise(
      Effect.gen(function* () {
        yield* Fs.copy(srcDir, destDir, { filter: () => true })
        return yield* Fs.readString(Fs.Path.AbsFile.fromString('/dest/lib/util.ts'))
      }).pipe(Effect.provide(Fs.Memory.layer(layout))),
    )

    expect(content).toBe('export const util = 1')
  })
})
