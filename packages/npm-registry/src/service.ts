import { Context, Effect } from 'effect'
import type { NpmCliError, PublishOptions, WhoamiOptions } from './cli.js'

/**
 * Service interface for npm CLI operations.
 */
export interface NpmCliService {
  /**
   * Run `npm whoami` to get the authenticated npm username.
   */
  readonly whoami: (options?: WhoamiOptions) => Effect.Effect<string, NpmCliError>

  /**
   * Run `npm publish` to publish a package.
   */
  readonly publish: (options: PublishOptions) => Effect.Effect<void, NpmCliError>
}

/**
 * Service tag for npm CLI operations.
 *
 * Use with `NpmCliLive` or `NpmCliDryRun` layers.
 *
 * @example
 * ```ts
 * import { NpmRegistry } from '@kitz/npm-registry'
 *
 * const program = Effect.gen(function*() {
 *   const cli = yield* NpmRegistry.NpmCli
 *   yield* cli.publish({ cwd: pkgDir, access: 'public' })
 * })
 *
 * // Production: actually runs npm
 * program.pipe(Effect.provide(NpmRegistry.NpmCliLive))
 *
 * // Dry run: just logs
 * program.pipe(Effect.provide(NpmRegistry.NpmCliDryRun))
 * ```
 */
export class NpmCli extends Context.Tag('NpmCli')<NpmCli, NpmCliService>() {}
