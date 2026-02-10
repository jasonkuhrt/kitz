import { Fs } from '@kitz/fs'
import { Layer } from 'effect'
import { Env } from './env.js'
import type { Arch, Os } from './types.js'

/**
 * Pure environment object for Node.js runtime.
 *
 * Use this for non-Effect code that needs cross-platform env access.
 * The conditional exports ensure the correct platform module is loaded.
 *
 * @see https://nodejs.org/api/process.html
 */
export const env = {
  cwd: Fs.Path.AbsDir.fromString(process.cwd()),
  argv: process.argv,
  vars: process.env as Record<string, string | undefined>,
  platform: 'node' as const,
  os: process.platform as Os,
  arch: process.arch as Arch,
  exit: (code?: number): never => process.exit(code),
}

/**
 * Live layer for Node.js runtime.
 *
 * @see https://nodejs.org/api/process.html
 */
export const Live = Layer.succeed(Env, env)
