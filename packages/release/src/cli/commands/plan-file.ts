import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import * as Api from '../../api/__.js'

type PlanSource = 'active' | 'custom'

interface PlanLookupContext {
  readonly path?: Fs.Path
  readonly source: PlanSource
}

interface BasePlanState {
  readonly location: Api.Planner.Store.ActivePlanLocation
  readonly source: PlanSource
}

export interface PlanLoadedState extends BasePlanState {
  readonly _tag: 'PlanLoaded'
  readonly plan: Api.Planner.Plan
}

export interface PlanMissingState extends BasePlanState {
  readonly _tag: 'PlanMissing'
}

export interface PlanInvalidState extends BasePlanState {
  readonly _tag: 'PlanInvalid'
  readonly error: Resource.ResourceError
}

export type PlanState = PlanLoadedState | PlanMissingState | PlanInvalidState

const renderPlanLabel = (source: PlanSource): string =>
  source === 'active' ? 'Active release plan' : 'Release plan'

const renderPlanPath = (location: Api.Planner.Store.ActivePlanLocation): string =>
  Fs.Path.toString(location.file)

const renderRegenerateCommand = (state: PlanMissingState | PlanInvalidState): string =>
  `release plan --lifecycle <official|candidate|ephemeral>${
    state.source === 'custom' ? ` --out ${renderPlanPath(state.location)}` : ''
  }`

export const loadPlan = (
  context: PlanLookupContext,
): Effect.Effect<PlanState, never, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const location = yield* Api.Planner.Store.resolvePlanLocation(context.path)
    const result = yield* Api.Planner.Store.read(context.path).pipe(Effect.result)

    if (result._tag === 'Failure') {
      return {
        _tag: 'PlanInvalid',
        location,
        source: context.source,
        error: result.failure,
      } satisfies PlanInvalidState
    }

    if (Option.isNone(result.success)) {
      return {
        _tag: 'PlanMissing',
        location,
        source: context.source,
      } satisfies PlanMissingState
    }

    return {
      _tag: 'PlanLoaded',
      location,
      source: context.source,
      plan: result.success.value,
    } satisfies PlanLoadedState
  })

export const loadActivePlan = (): Effect.Effect<
  PlanState,
  never,
  Env.Env | FileSystem.FileSystem
> => loadPlan({ source: 'active' })

export const formatMissingPlanMessage = (state: PlanMissingState): readonly string[] => [
  `${renderPlanLabel(state.source)} not found at ${renderPlanPath(state.location)}.`,
  `Run '${renderRegenerateCommand(state)}' first to generate a plan.`,
]

export const formatInvalidPlanMessage = (state: PlanInvalidState): readonly string[] => [
  `${renderPlanLabel(state.source)} at ${renderPlanPath(state.location)} is unreadable.`,
  Resource.isParseError(state.error)
    ? `It looks stale, malformed, or written by an older @kitz/release schema. (${state.error.context.detail})`
    : state.error.message,
  `Run '${renderRegenerateCommand(state)}' to generate a fresh plan.`,
  ...(state.source === 'active'
    ? [`If you do not need it, delete ${renderPlanPath(state.location)}.`]
    : []),
]

export const formatIgnoredInvalidPlanMessage = (state: PlanInvalidState): readonly string[] => [
  ...formatInvalidPlanMessage(state),
  'Ignoring the invalid active plan and computing doctor scenarios from the current repo state.',
]

export const formatUnsupportedExecutionPlanMessage = (
  plan: Api.Planner.Plan,
): readonly string[] => {
  const missing = [
    ...(plan.planDigest === undefined ? ['planDigest'] : []),
    ...(plan.publishIntent === undefined ? ['publishIntent'] : []),
  ]
  return [
    'This release plan is missing the frozen v2 execution contract.',
    `Missing field(s): ${missing.join(', ')}.`,
    'Run `release plan --lifecycle <official|candidate|ephemeral>` again with the current @kitz/release before executing, resuming, graphing, or checking durable status.',
  ]
}

export const hasExecutablePlanContract = (
  plan: Api.Planner.Plan,
): plan is Api.Planner.Plan & {
  readonly planDigest: Api.ReleaseContract.PlanDigest
  readonly publishIntent: Api.ReleaseContract.PublishIntent
} => plan.planDigest !== undefined && plan.publishIntent !== undefined
