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
  static is = Schema.is(Operator)
  static decode = Schema.decodeUnknownEffect(Operator)
  static decodeSync = Schema.decodeUnknownSync(Operator)
  static encode = Schema.encodeUnknownEffect(Operator)
  static encodeSync = Schema.encodeUnknownSync(Operator)
  static equivalence = Schema.toEquivalence(Operator)
  static ordered = false as const
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
  static is = Schema.is(ResolvedOperator)
  static decode = Schema.decodeUnknownEffect(ResolvedOperator)
  static decodeSync = Schema.decodeUnknownSync(ResolvedOperator)
  static encode = Schema.encodeUnknownEffect(ResolvedOperator)
  static encodeSync = Schema.encodeUnknownSync(ResolvedOperator)
  static equivalence = Schema.toEquivalence(ResolvedOperator)
  static ordered = false as const
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
