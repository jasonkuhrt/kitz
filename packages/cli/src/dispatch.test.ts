import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Platform } from '@kitz/platform'
import { dispatch, DiscoverCommandsDirNotFoundError, discoverCommandPointers } from './dispatch.js'

const withTempDir = async <A>(run: (dir: string) => Promise<A> | A): Promise<A> => {
  const dir = mkdtempSync(path.join('/tmp', 'kitz-cli-dispatch-'))

  try {
    return await run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as { __kitzCliDispatchLoaded?: string }).__kitzCliDispatchLoaded
})

describe('discoverCommandPointers', () => {
  test('keeps runtime command modules and filters build artifacts', async () => {
    const commands = await Effect.runPromise(
      Effect.provide(
        discoverCommandPointers(Fs.Path.AbsDir.fromString('/commands/')),
        Fs.Memory.layerFromDiskLayout({
          '/commands/$default.js': '',
          '/commands/$default.d.ts': '',
          '/commands/$default.js.map': '',
          '/commands/apply.d.mts': '',
          '/commands/apply.mjs': '',
          '/commands/lint.cts': '',
          '/commands/lint.d.cts': '',
          '/commands/readme.md': '',
        }),
      ),
    )

    expect(commands.map((command) => Fs.Path.toString(command))).toEqual([
      '/commands/$default.js',
      '/commands/apply.mjs',
      '/commands/lint.cts',
    ])
  })

  test('maps missing command directories to contextual errors', async () => {
    const error = await withTempDir((dir) =>
      Effect.runPromise(
        discoverCommandPointers(Fs.Path.AbsDir.fromString(path.join(dir, 'missing'))).pipe(
          Effect.provide(Platform.FileSystem.layer),
          Effect.flip,
        ),
      ),
    )

    expect(error).toBeInstanceOf(DiscoverCommandsDirNotFoundError)
    expect(error.message).toContain('Commands directory not found:')
  })
})

describe('dispatch', () => {
  test('omits $default from unknown-command suggestions', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const exit = ((code?: number): never => {
      throw new Error(`exit:${code}`)
    }) as Env.EnvService[`exit`]

    const program = dispatch(Fs.Path.AbsDir.fromString('/commands/'))
    const layer = Layer.mergeAll(
      Env.Test({
        argv: ['node', 'cli.js', 'nope'],
        exit,
      }),
      Fs.Memory.layerFromDiskLayout({
        '/commands/$default.js': '',
        '/commands/apply.js': '',
        '/commands/status.js': '',
      }),
    )

    await expect(Effect.runPromise(Effect.provide(program, layer))).rejects.toThrow('exit:1')

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [message] = errorSpy.mock.calls[0]!
    expect(message).toContain('Error: No such command "nope".')
    expect(message).toContain('→ apply')
    expect(message).toContain('→ status')
    expect(message).not.toContain('$default')
  })

  test('prints available commands when no default command exists', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const exit = ((code?: number): never => {
      throw new Error(`exit:${code}`)
    }) as Env.EnvService[`exit`]

    const program = dispatch(Fs.Path.AbsDir.fromString('/commands/'))
    const layer = Layer.mergeAll(
      Env.Test({
        argv: ['node', 'cli.js'],
        exit,
      }),
      Fs.Memory.layerFromDiskLayout({
        '/commands/apply.js': '',
        '/commands/status.js': '',
      }),
    )

    await expect(Effect.runPromise(Effect.provide(program, layer))).rejects.toThrow('exit:1')

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [message] = errorSpy.mock.calls[0]!
    expect(message).toContain('Error: You must specify a command.')
    expect(message).toContain('→ apply')
    expect(message).toContain('→ status')
  })

  test('imports the matched runtime command module', async () => {
    await withTempDir(async (dir) => {
      const commandsDir = path.join(dir, 'commands')
      const commandFilePath = path.join(commandsDir, 'apply.mjs')

      mkdirSync(commandsDir, { recursive: true })
      writeFileSync(
        commandFilePath,
        `globalThis.__kitzCliDispatchLoaded = 'apply'\nexport default null\n`,
      )

      const program = dispatch(Fs.Path.AbsDir.fromString(commandsDir))

      await Effect.runPromise(
        Effect.provide(
          program,
          Layer.mergeAll(
            Env.Test({
              argv: ['node', 'cli.js', 'apply'],
              exit: ((code?: number): never => {
                throw new Error(`unexpected exit:${code}`)
              }) as Env.EnvService[`exit`],
            }),
            Platform.FileSystem.layer,
          ),
        ),
      )

      expect((globalThis as { __kitzCliDispatchLoaded?: string }).__kitzCliDispatchLoaded).toBe(
        'apply',
      )
    })
  })
})
