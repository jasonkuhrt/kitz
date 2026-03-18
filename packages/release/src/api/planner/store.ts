import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import { type Plan } from './models/plan.js'
import { PLAN_DIR, PLAN_FILE, resource } from './resource.js'

export interface ActivePlanLocation {
  readonly dir: Fs.Path.AbsDir
  readonly file: Fs.Path.AbsFile
}

export const activePlanDisplayPath = Fs.Path.toString(PLAN_FILE)

export const resolveActivePlanLocation: Effect.Effect<ActivePlanLocation, never, Env.Env> =
  Effect.gen(function* () {
    const env = yield* Env.Env
    return {
      dir: Fs.Path.join(env.cwd, PLAN_DIR),
      file: Fs.Path.join(env.cwd, PLAN_FILE),
    }
  })

const withActivePlanDir = <A, R>(
  f: (dir: Fs.Path.AbsDir) => Effect.Effect<A, Resource.ResourceError, R>,
) => Effect.flatMap(resolveActivePlanLocation, ({ dir }) => f(dir))

export const readActive = withActivePlanDir(resource.read)

export const readActiveRequired = withActivePlanDir(resource.readRequired)

export const readActiveOrEmpty = withActivePlanDir(resource.readOrEmpty)

export const writeActive = (plan: Plan) => withActivePlanDir((dir) => resource.write(plan, dir))

export const deleteActive = withActivePlanDir(resource.delete)
