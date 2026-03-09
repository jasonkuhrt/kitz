import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { dispatch, discoverCommandPointers } from './dispatch.js'

afterEach(() => {
  vi.restoreAllMocks()
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
})

describe('dispatch', () => {
  test('omits $default from unknown-command suggestions', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const exit = vi.fn((code?: number) => {
      throw new Error(`exit:${code}`)
    })

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
})
