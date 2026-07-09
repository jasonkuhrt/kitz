import { Context, Effect, Layer, Schema as S } from 'effect'
import { AbsDir } from '../models/AbsDir.js'

/**
 * Current working directory service.
 *
 * The service value is an `AbsDir` snapshot captured when the layer is
 * provided; later `process.chdir` calls do not update it. Deep code should take
 * an explicit `AbsDir` base. This service is only the process-boundary adapter,
 * not a sync cwd accessor.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const cwd = yield* Cwd
 *   return cwd
 * })
 * ```
 */
export class Cwd extends Context.Service<Cwd, AbsDir>()('@kitz/effect/Path/Cwd') {
  /**
   * Snapshot `process.cwd()` at layer provision. Tests can override it with
   * `Layer.succeed(Cwd)(someAbsDir)`.
   */
  static readonly layer = Layer.effect(Cwd)(Effect.sync(() => S.decodeSync(AbsDir)(process.cwd())))
}
