import { Lang } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Layer, ServiceMap } from 'effect'
import type { Arch, Os, Platform } from './types.js'

/**
 * Environment service interface.
 * Values are captured when the layer is created.
 */
export interface EnvService {
  readonly cwd: Fs.Path.AbsDir
  readonly argv: string[]
  readonly vars: Record<string, string | undefined>
  readonly platform: Platform
  readonly os: Os
  readonly arch: Arch
  readonly exit: (code?: number) => never
}

/**
 * Effect service for runtime environment access.
 *
 * Provides typed, testable access to:
 * - Current working directory (as AbsDir)
 * - Command line arguments
 * - Environment variables
 * - Platform, OS, and architecture info
 * - Process exit
 *
 * @example
 * ```ts
 * import { Env } from '@wollybeard/kit'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   const env = yield* Env
 *   console.log(`Running in ${env.cwd} with args:`, env.argv)
 * })
 *
 * Effect.runPromise(Effect.provide(program, Env.Live))
 * ```
 */
export class Env extends ServiceMap.Service<Env, EnvService>()('Env') {}

/**
 * Test layer for mocking environment in tests.
 *
 * @example
 * ```ts
 * const testEnv = Test({
 *   cwd: Fs.Path.AbsDir.make({ segments: ['test'] }),
 *   argv: ['node', 'test.js', '--verbose'],
 *   vars: { NODE_ENV: 'test' },
 * })
 *
 * Effect.runPromise(Effect.provide(program, testEnv))
 * ```
 */
export const Test = (config: Partial<EnvService> = {}) =>
  Layer.succeed(Env)({
    cwd: config.cwd ?? Fs.Path.AbsDir.fromString('/'),
    argv: config.argv ?? [],
    vars: config.vars ?? {},
    platform: config.platform ?? 'node',
    os: config.os ?? 'linux',
    arch: config.arch ?? 'x64',
    exit:
      config.exit ??
      ((code?: number) => {
        return Lang.panic(`Env.exit(${code}) called in test environment`)
      }),
  })
