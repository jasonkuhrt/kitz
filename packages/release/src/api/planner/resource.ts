import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { Plan, assertLifecycleConsistency } from './models/plan.js'

/**
 * Directory where release plan files are stored.
 */
export const PLAN_DIR = Fs.Path.fromString('./.release/')

/**
 * Path to the plan file.
 */
export const PLAN_FILE = Fs.Path.fromString('./.release/plan.json')

/**
 * Resource for reading/writing plan.json with Schema validation.
 *
 * Reads and writes rich Plan data directly - no manual conversion needed.
 *
 * @example
 * ```ts
 * // Create and write a plan
 * const plan = Plan.make('official', releases, cascades)
 * yield* resource.write(plan, releaseDir)
 *
 * // Read a plan directly
 * const planOption = yield* resource.read(releaseDir)
 * if (Option.isSome(planOption)) {
 *   const { releases, cascades } = planOption.value
 *   // releases/cascades are Item instances with getters
 * }
 * ```
 */
const baseResource = Resource.createJson('plan.json', Plan, Plan.empty)
const planFilename = Fs.Path.RelFile.fromString('./plan.json')

export const resolvePlanFile = (path: Fs.Path.$Abs): Fs.Path.AbsFile =>
  Fs.Path.AbsFile.is(path) ? path : Fs.Path.join(path, planFilename)

export const resolvePlanDir = (path: Fs.Path.$Abs): Fs.Path.AbsDir =>
  Fs.Path.AbsFile.is(path) ? Fs.Path.toDir(path) : path

const validatePlan = <T extends Plan>(
  path: Fs.Path.$Abs,
  plan: T,
): Effect.Effect<T, Resource.ResourceError> =>
  Effect.try({
    try: () => assertLifecycleConsistency(plan),
    catch: (cause) =>
      new Resource.ParseError({
        context: {
          path: resolvePlanFile(path),
          detail: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  })

export const resource = {
  read: (path: Fs.Path.$Abs) =>
    baseResource
      .read(path)
      .pipe(
        Effect.flatMap((result) =>
          Option.isNone(result)
            ? Effect.succeed(Option.none())
            : validatePlan(path, result.value).pipe(Effect.map(Option.some)),
        ),
      ),
  readRequired: (path: Fs.Path.$Abs) =>
    baseResource.readRequired(path).pipe(Effect.flatMap((plan) => validatePlan(path, plan))),
  readOrEmpty: (path: Fs.Path.$Abs) =>
    baseResource.readOrEmpty(path).pipe(Effect.flatMap((plan) => validatePlan(path, plan))),
  write: (value: Plan, path: Fs.Path.$Abs) =>
    validatePlan(path, value).pipe(Effect.flatMap((plan) => baseResource.write(plan, path))),
  update: (path: Fs.Path.$Abs, fn: (current: Plan) => Plan) =>
    Effect.gen(function* () {
      const current = yield* resource.readOrEmpty(path)
      const updated = yield* validatePlan(path, fn(current))
      yield* baseResource.write(updated, path)
      return updated
    }),
  delete: (path: Fs.Path.$Abs) => baseResource.delete(path),
}
