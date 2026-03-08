import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import type { PackOptions, PublishOptions, WhoamiOptions } from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'

/**
 * Dry-run implementation of NpmCli that logs what it would do.
 *
 * Useful for testing release workflows without actually publishing.
 */
export const NpmCliDryRun: Layer.Layer<NpmCli> = Layer.succeed(NpmCli, {
  whoami: (_options?: WhoamiOptions) =>
    Effect.gen(function* () {
      yield* Effect.log('[dry-run] Would run: npm whoami')
      return 'dry-run-user'
    }),

  pack: (options: PackOptions) =>
    Effect.gen(function* () {
      yield* Effect.log(
        `[dry-run] Would run: npm pack --json --pack-destination ${Fs.Path.toString(options.packDestination)} in ${Fs.Path.toString(options.cwd)}`,
      )
      return {
        filename: 'dry-run-package-0.0.0.tgz',
        tarball: Fs.Path.join(
          options.packDestination,
          Fs.Path.RelFile.fromString('./dry-run-package-0.0.0.tgz'),
        ),
      }
    }),

  publish: (options: PublishOptions) =>
    Effect.gen(function* () {
      const args = [
        'publish',
        Fs.Path.toString(options.tarball),
        '--access',
        options.access ?? 'public',
      ]
      if (options.ignoreScripts ?? true) args.push('--ignore-scripts')
      if (options.tag) args.push('--tag', options.tag)
      if (options.registry) args.push('--registry', options.registry)

      yield* Effect.log(`[dry-run] Would run: npm ${args.join(' ')}`)
    }),
} satisfies NpmCliService)
