import { Lang } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Layer } from 'effect'
import { Env } from './env.js'

/**
 * Pure environment object for browser environment.
 *
 * Use this for non-Effect code that needs cross-platform env access.
 * The conditional exports ensure the correct platform module is loaded.
 *
 * Browser has no environment variables, so this provides safe defaults/stubs.
 */
export const env = {
  cwd: Fs.Path.AbsDir.make({ segments: [] }),
  argv: [] as string[],
  vars: {} as Record<string, string | undefined>,
  platform: 'browser' as const,
  os: 'linux' as const,
  arch: 'x64' as const,
  exit: (code?: number): never => {
    Lang.panic(`Env.exit(${code}) called in browser environment`)
  },
}

/**
 * Live layer for browser environment.
 */
export const Live = Layer.succeed(Env, env)
