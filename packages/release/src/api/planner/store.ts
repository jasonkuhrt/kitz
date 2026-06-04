import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, FileSystem } from 'effect'
import { type PlanDigest } from '../release-contract.js'
import { type Plan } from './models/plan.js'
import { PLAN_FILE, resolvePlanDir, resolvePlanFile, resource } from './resource.js'

export interface ActivePlanLocation {
  readonly path: Fs.Path.$Abs
  readonly dir: Fs.Path.AbsDir
  readonly file: Fs.Path.AbsFile
}

export const activePlanDisplayPath = Fs.Path.toString(PLAN_FILE)

const resolvePlanInput = (path: Fs.Path | undefined, cwd: Fs.Path.AbsDir): Fs.Path.$Abs => {
  if (path === undefined) {
    return Fs.Path.join(cwd, PLAN_FILE)
  }

  return Fs.Path.ensureAbsolute(path, cwd)
}

export const resolvePlanLocation = (
  path?: Fs.Path,
): Effect.Effect<ActivePlanLocation, never, Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const resolvedPath = resolvePlanInput(path, env.cwd)
    return {
      path: resolvedPath,
      dir: resolvePlanDir(resolvedPath),
      file: resolvePlanFile(resolvedPath),
    }
  })

export const resolveActivePlanLocation: Effect.Effect<ActivePlanLocation, never, Env.Env> =
  resolvePlanLocation()

const withPlanPath = <A, R>(
  path: Fs.Path | undefined,
  f: (resolvedPath: Fs.Path.$Abs) => Effect.Effect<A, Resource.ResourceError, R>,
) => Effect.flatMap(resolvePlanLocation(path), ({ path: resolvedPath }) => f(resolvedPath))

export const read = (path?: Fs.Path) => withPlanPath(path, resource.read)

export const readRequired = (path?: Fs.Path) => withPlanPath(path, resource.readRequired)

export const readOrEmpty = (path?: Fs.Path) => withPlanPath(path, resource.readOrEmpty)

export const write = (plan: Plan, path?: Fs.Path) =>
  withPlanPath(path, (resolvedPath) => resource.write(plan, resolvedPath))

export const delete_ = (path?: Fs.Path) => withPlanPath(path, resource.delete)

/**
 * Resolve the immutable archive path for a plan digest:
 * `<cwd>/.release/plans/<planDigest>.json`.
 */
export const resolveArchiveLocation = (
  planDigest: PlanDigest,
): Effect.Effect<Fs.Path.AbsFile, never, Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    return Fs.Path.join(
      env.cwd,
      Fs.Path.RelFile.fromString(`./.release/plans/${planDigest.value}.json`),
    )
  })

/**
 * Archive a plan immutably under `.release/plans/<planDigest>.json` and return
 * the archive path. Append-only: the digest-addressed name makes re-archiving
 * the same plan idempotent. Does not touch the active `plan.json` pointer.
 */
export const archive = (
  plan: Plan,
  planDigest: PlanDigest,
): Effect.Effect<Fs.Path.AbsFile, Resource.ResourceError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const file = yield* resolveArchiveLocation(planDigest)
    yield* resource.write(plan, file)
    return file
  })

export const readActive = read()

export const readActiveRequired = readRequired()

export const readActiveOrEmpty = readOrEmpty()

export const writeActive = (plan: Plan) => write(plan)

export const deleteActive = delete_()
