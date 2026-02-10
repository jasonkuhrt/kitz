/**
 * Minimal Bun global type declarations for APIs used in this module.
 * @see https://bun.sh/docs/api/globals
 */
declare const Bun: {
  env: Record<string, string | undefined>
}

import { Fs } from '@kitz/fs'
import { Layer } from 'effect'
import { Env } from './env.js'
import type { Arch, Os } from './types.js'

/**
 * Pure environment object for Bun runtime.
 *
 * Use this for non-Effect code that needs cross-platform env access.
 * The conditional exports ensure the correct platform module is loaded.
 *
 * Bun's philosophy is Node.js compatibility - it doesn't provide native alternatives
 * for cwd, argv, platform, arch, or exit. Using process.* for these is idiomatic.
 * The only Bun-native API we use is Bun.env for environment variables.
 *
 * @see https://bun.sh/reference/bun/env - Bun.env
 * @see https://bun.com/reference/bun/argv - Bun.argv vs process.argv
 * @see https://bun.com/docs/runtime/environment-variables
 */
export const env = {
  cwd: Fs.Path.AbsDir.fromString(process.cwd()),
  argv: process.argv,
  vars: Bun.env as Record<string, string | undefined>,
  platform: 'bun' as const,
  os: process.platform as Os,
  arch: process.arch as Arch,
  exit: (code?: number): never => process.exit(code),
}

/**
 * Live layer for Bun runtime.
 *
 * @see https://bun.sh/reference/bun/env - Bun.env
 */
export const Live = Layer.succeed(Env, env)
