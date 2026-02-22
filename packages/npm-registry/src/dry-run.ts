import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import type { PublishOptions, WhoamiOptions } from './cli.js'
import { NpmCli, type NpmCliService } from './service.js'

/**
 * Dry-run implementation of NpmCli that logs what it would do.
 *
 * Useful for testing release workflows without actually publishing.
 */
export const NpmCliDryRun: Layer.Layer<NpmCli> = Layer.succeed(
  NpmCli,
  {
    whoami: (_options?: WhoamiOptions) =>
      Effect.gen(function*() {
        yield* Effect.log('[dry-run] Would run: npm whoami')
        return 'dry-run-user'
      }),

    publish: (options: PublishOptions) =>
      Effect.gen(function*() {
        const args = ['publish', '--access', options.access ?? 'public']
        if (options.tag) args.push('--tag', options.tag)
        if (options.registry) args.push('--registry', options.registry)

        yield* Effect.log(`[dry-run] Would run: npm ${args.join(' ')} in ${Fs.Path.toString(options.cwd)}`)
      }),
  } satisfies NpmCliService,
)
