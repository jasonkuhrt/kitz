import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import * as EnvModule from './_.js'
import * as PublicEnv from './__.js'
import { Env, Test as makeTestLayer } from './env.js'
import { env as nodeEnv, Live as nodeLive } from './live.node.js'

describe('env', () => {
  test('exports the Env namespace', () => {
    expect(EnvModule.Env.Test).toBe(makeTestLayer)
    expect(PublicEnv.Env).toBe(Env)
    expect(PublicEnv.Live).toBeDefined()
  })

  test('provides default and overridden test environments', async () => {
    const readEnv = Effect.gen(function* () {
      return yield* Env
    })

    const defaults = await Effect.runPromise(readEnv.pipe(Effect.provide(makeTestLayer())))
    const custom = await Effect.runPromise(
      readEnv.pipe(
        Effect.provide(
          makeTestLayer({
            cwd: Fs.Path.AbsDir.fromString('/repo'),
            argv: ['bun', 'test'],
            vars: { KITZ_ENV: 'test' },
            platform: 'bun',
            os: 'darwin',
            arch: 'arm64',
            exit: (() => {
              throw new Error('exit called')
            }) as never,
          }),
        ),
      ),
    )

    expect(defaults.cwd).toStrictEqual(Fs.Path.AbsDir.fromString('/'))
    expect(defaults.platform).toBe('node')
    expect(defaults.argv).toEqual([])
    expect(defaults.vars).toEqual({})
    expect(defaults.os).toBe('linux')
    expect(defaults.arch).toBe('x64')
    expect(() => defaults.exit(9)).toThrow('Env.exit(9) called in test environment')
    expect(custom.cwd).toStrictEqual(Fs.Path.AbsDir.fromString('/repo'))
    expect(custom.vars[`KITZ_ENV`]).toBe('test')
    expect(custom.platform).toBe('bun')
    expect(custom.os).toBe('darwin')
    expect(custom.arch).toBe('arm64')
    expect(() => custom.exit(3)).toThrow('exit called')
  })

  test('exposes the node live environment used by Vitest', () => {
    const runtimePlatform = process.versions['bun'] ? 'bun' : 'node'

    expect(nodeEnv.platform).toBe('node')
    expect(Array.isArray(nodeEnv.argv)).toBe(true)
    expect(nodeLive).toBeDefined()
    expect(PublicEnv.env.platform).toBe(runtimePlatform)
  })

  test('delegates the node exit function to process.exit', () => {
    const originalExit = process.exit
    const calls: Array<number | undefined> = []

    process.exit = ((code?: number) => {
      calls.push(code)
      throw new Error(`process.exit(${code})`)
    }) as never

    try {
      expect(() => nodeEnv.exit(7)).toThrow('process.exit(7)')
      expect(calls).toEqual([7])
    } finally {
      process.exit = originalExit
    }
  })
})
