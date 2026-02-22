import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Plan } from './models/plan.js'

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
 * const plan = Plan.make('stable', releases, cascades)
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
export const resource = Resource.createJson('plan.json', Plan, Plan.empty)
