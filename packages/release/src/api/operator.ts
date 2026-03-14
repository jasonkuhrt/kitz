import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
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
  releaseScript: Schema.String.pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(defaultReleaseScript),
  ),
  /** Optional repo-specific preparation scripts to run before release steps. */
  prepareScripts: Schema.Array(Schema.String).pipe(
    Schema.optionalKey,
    Schema.withDecodingDefaultKey(defaultPrepareScripts as () => readonly string[]),
  ),
}) {
  static make = this.makeUnsafe
}

/**
 * Resolved operator command surface after package-manager detection.
 */
export class ResolvedOperator extends Schema.Class<ResolvedOperator>('ResolvedOperator')({
  manager: Pkg.Manager.DetectedPackageManager,
  releaseCommand: Schema.String,
  prepareCommands: Schema.Array(Schema.String),
}) {
  static make = this.makeUnsafe
}

export const defaultOperator = (): Operator => Operator.make({})

export type ResolveError = PlatformError | Resource.ResourceError

export const resolve = (
  operator: Operator,
): Effect.Effect<ResolvedOperator, ResolveError, FileSystem.FileSystem | Env.Env> =>
  Effect.gen(function* () {
    const manager = yield* Pkg.Manager.detect()

    return ResolvedOperator.make({
      manager,
      releaseCommand: Pkg.Manager.renderScriptCommand(
        manager.name,
        operator.releaseScript ?? 'release',
      ),
      prepareCommands: (operator.prepareScripts ?? []).map((script: string) =>
        Pkg.Manager.renderScriptCommand(manager.name, script),
      ),
    })
  })
