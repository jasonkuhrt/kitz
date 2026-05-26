import { Effect, Context } from 'effect'
import type {
  AccessOptions,
  AccessStatus,
  NpmCliError,
  ObserveVersionOptions,
  PackOptions,
  PackResult,
  PublishOptions,
  RegistryVersionObservation,
  WhoamiOptions,
} from './cli.js'
import type { ViewOptions } from './cli.js'

/**
 * Service interface for npm CLI operations.
 */
export interface NpmCliService {
  /**
   * Run `npm whoami` to get the authenticated npm username.
   */
  readonly whoami: (options?: WhoamiOptions) => Effect.Effect<string, NpmCliError>

  /**
   * Run `npm pack` to create a publishable tarball.
   */
  readonly pack: (options: PackOptions) => Effect.Effect<PackResult, NpmCliError>

  /**
   * Run `npm publish` to publish a prepared tarball.
   */
  readonly publish: (options: PublishOptions) => Effect.Effect<void, NpmCliError>

  /**
   * Run `npm view` to check whether an exact package version exists.
   */
  readonly hasVersion: (
    packageName: string,
    version: string,
    options?: ViewOptions,
  ) => Effect.Effect<boolean, NpmCliError>

  /**
   * Read exact version metadata, dist-tags, and optional tarball byte proof.
   */
  readonly observeVersion: (
    packageName: string,
    version: string,
    options?: ObserveVersionOptions,
  ) => Effect.Effect<RegistryVersionObservation, NpmCliError>

  /**
   * List packages visible to a user or scope through `npm access`.
   */
  readonly listAccessPackages: (
    userOrScope: string,
    options?: AccessOptions,
  ) => Effect.Effect<Readonly<Record<string, string>>, NpmCliError>

  /**
   * List collaborators for a package through `npm access`.
   */
  readonly listAccessCollaborators: (
    packageName: string,
    options?: AccessOptions,
  ) => Effect.Effect<Readonly<Record<string, string>>, NpmCliError>

  /**
   * Read a package's access status through `npm access get status`.
   */
  readonly getAccessStatus: (
    packageName: string,
    options?: AccessOptions,
  ) => Effect.Effect<AccessStatus, NpmCliError>
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
 *   const packed = yield* cli.pack({ cwd: pkgDir, packDestination: artifactDir })
 *   yield* cli.publish({ tarball: packed.tarball, access: 'public' })
 * })
 *
 * // Production: actually runs npm
 * program.pipe(Effect.provide(NpmRegistry.NpmCliLive))
 *
 * // Dry run: just logs
 * program.pipe(Effect.provide(NpmRegistry.NpmCliDryRun))
 * ```
 */
export class NpmCli extends Context.Service<NpmCli, NpmCliService>()('NpmCli') {}
