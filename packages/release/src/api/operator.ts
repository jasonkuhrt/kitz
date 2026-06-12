import { PlatformError, FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Sch } from '@kitz/sch'
import { Effect, Schema } from 'effect'

/**
 * Operator-facing script names declared in repo config.
 *
 * Defaults live on the schema (single source): decoding `{}` yields the
 * fully-defaulted operator surface.
 */
export class Operator extends Sch.Class<Operator>()('Operator', {
  /** Script used to invoke the release CLI locally (default: `'release'`). */
  releaseScript: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.sync(() => 'release'))),
  /** Optional repo-specific preparation scripts to run before release steps. */
  prepareScripts: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.sync((): readonly string[] => [])),
  ),
}) {}

/**
 * Resolved operator command surface after package-manager detection.
 */
export class ResolvedOperator extends Sch.Class<ResolvedOperator>()('ResolvedOperator', {
  manager: Pkg.Manager.DetectedPackageManager,
  releaseCommand: Schema.String,
  prepareCommands: Schema.Array(Schema.String),
}) {}

export type ResolveError = PlatformError.PlatformError | Resource.ResourceError

export const resolve = (
  operator: Operator,
): Effect.Effect<ResolvedOperator, ResolveError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const manager = yield* Pkg.Manager.detect()

    return ResolvedOperator.make({
      manager,
      releaseCommand: Pkg.Manager.renderScriptCommand(manager.name, operator.releaseScript),
      prepareCommands: operator.prepareScripts.map((script: string) =>
        Pkg.Manager.renderScriptCommand(manager.name, script),
      ),
    })
  })
