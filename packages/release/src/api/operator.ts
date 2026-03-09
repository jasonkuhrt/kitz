import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Env } from '@kitz/env'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Schema } from 'effect'

const defaultReleaseScript = (): string => 'release'
const defaultPrepareScripts = (): readonly string[] => []

/**
 * Operator-facing script names declared in repo config.
 */
export class Operator extends Schema.Class<Operator>('Operator')({
  /** Script used to invoke the release CLI locally. */
  releaseScript: Schema.optionalWith(Schema.String, { default: defaultReleaseScript }),
  /** Optional repo-specific preparation scripts to run before release steps. */
  prepareScripts: Schema.optionalWith(Schema.Array(Schema.String), {
    default: defaultPrepareScripts,
  }),
}) {}

/**
 * Resolved operator command surface after package-manager detection.
 */
export class ResolvedOperator extends Schema.Class<ResolvedOperator>('ResolvedOperator')({
  manager: Pkg.Manager.DetectedPackageManager,
  releaseCommand: Schema.String,
  prepareCommands: Schema.Array(Schema.String),
}) {}

export const defaultOperator = (): Operator => Operator.make({})

export type ResolveError = PlatformError | Resource.ResourceError

export const resolve = (
  operator: Operator,
): Effect.Effect<ResolvedOperator, ResolveError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const manager = yield* Pkg.Manager.detect()

    return ResolvedOperator.make({
      manager,
      releaseCommand: Pkg.Manager.renderScriptCommand(manager.name, operator.releaseScript),
      prepareCommands: operator.prepareScripts.map((script) =>
        Pkg.Manager.renderScriptCommand(manager.name, script),
      ),
    })
  })
