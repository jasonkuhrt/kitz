import { Tui } from '@kitz/tui'
import type { KeyEvent } from '@opentui/core'
import { Array as A, Effect, Option } from 'effect'
import * as Planner from '../../api/planner/__.js'
import {
  Data,
  renderPlanText,
  serializePlanJson,
  type FocusPane,
  type Lifecycle,
  type WorkspaceContext,
} from './ui-atoms.js'

const focusOrder: readonly FocusPane[] = ['packages', 'plan', 'doctor', 'diff']
const lifecycles: readonly Lifecycle[] = ['official', 'candidate', 'ephemeral']

interface DraftPlanView {
  readonly plan: Planner.Plan
  readonly text: string
  readonly draftJson: string | undefined
  readonly plannedPackages: number
}

type ResourceState<A> =
  | { readonly _tag: 'Idle' }
  | { readonly _tag: 'Loading' }
  | { readonly _tag: 'Failure'; readonly message: string }
  | { readonly _tag: 'Ready'; readonly value: A }

type WorkspaceState =
  | { readonly _tag: 'Loading' }
  | { readonly _tag: 'Failure'; readonly message: string }
  | {
      readonly _tag: 'Ready'
      readonly value: WorkspaceContext | null
      readonly refreshing: boolean
    }

export interface DashboardState {
  readonly lifecycle: Lifecycle
  readonly excludedPackages: readonly string[]
  readonly focusPane: FocusPane
  readonly packageCursor: number
  readonly message: string
  readonly showHelp: boolean
  readonly workspace: WorkspaceState
  readonly workspaceLoads: number
  readonly plan: ResourceState<DraftPlanView>
  readonly doctor: ResourceState<string>
  // Request-generation counters guarding against stale command results
  // overwriting fresh state. Each time a new command of the named kind is
  // issued the counter increments; the result action carries the same
  // requestId, and the handler discards results whose requestId no longer
  // matches the latest counter. Necessary because the @kitz/tui runtime
  // forks commands off the dispatch lock — two BuildPlans (etc.) can run
  // in parallel and resolve out-of-order.
  readonly planRequestSeq: number
  readonly workspaceRequestSeq: number
  readonly doctorRequestSeq: number
}

export type DashboardAction =
  | { readonly _tag: 'FocusAdvanced' }
  | { readonly _tag: 'HelpDismissed' }
  | { readonly _tag: 'HelpToggled' }
  | { readonly _tag: 'LifecycleStepped'; readonly direction: 'next' | 'previous' }
  | { readonly _tag: 'PackageCursorMoved'; readonly direction: 'next' | 'previous' }
  | { readonly _tag: 'PackageToggled' }
  | { readonly _tag: 'PersistFailed'; readonly message: string }
  | { readonly _tag: 'PersistRequested' }
  | { readonly _tag: 'PersistSucceeded'; readonly cleared: boolean }
  | { readonly _tag: 'PlanBuildFailed'; readonly requestId: number; readonly message: string }
  | { readonly _tag: 'PlanBuilt'; readonly requestId: number; readonly draft: DraftPlanView }
  | { readonly _tag: 'QuitRequested' }
  | { readonly _tag: 'RefreshRequested' }
  | { readonly _tag: 'WorkspaceLoadFailed'; readonly requestId: number; readonly message: string }
  | {
      readonly _tag: 'WorkspaceLoaded'
      readonly requestId: number
      readonly workspace: WorkspaceContext | null
    }
  | { readonly _tag: 'DoctorBuildFailed'; readonly requestId: number; readonly message: string }
  | { readonly _tag: 'DoctorBuilt'; readonly requestId: number; readonly text: string }

export type DashboardCommand =
  | {
      readonly _tag: 'BuildDoctor'
      readonly requestId: number
      readonly workspace: WorkspaceContext
      readonly plan: Planner.Plan
    }
  | {
      readonly _tag: 'BuildPlan'
      readonly requestId: number
      readonly workspace: WorkspaceContext
      readonly lifecycle: Lifecycle
      readonly excludedPackages: readonly string[]
    }
  | { readonly _tag: 'LoadWorkspace'; readonly requestId: number }
  | { readonly _tag: 'PersistPlan'; readonly clear: boolean; readonly plan: Planner.Plan }
  | { readonly _tag: 'Quit' }

const idle = <A>(): ResourceState<A> => ({ _tag: 'Idle' })
const loading = <A>(): ResourceState<A> => ({ _tag: 'Loading' })
const failure = <A>(message: string): ResourceState<A> => ({ _tag: 'Failure', message })
const ready = <A>(value: A): ResourceState<A> => ({ _tag: 'Ready', value })
const actions = <const Actions extends readonly DashboardAction[]>(...items: Actions) => items

export const initialDashboardState: DashboardState = {
  lifecycle: 'official',
  excludedPackages: [],
  focusPane: 'packages',
  packageCursor: 0,
  message: 'Loading workspace...',
  showHelp: false,
  workspace: { _tag: 'Loading' },
  workspaceLoads: 0,
  plan: idle(),
  doctor: idle(),
  planRequestSeq: 0,
  workspaceRequestSeq: 0,
  doctorRequestSeq: 0,
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const nextLifecycle = (current: Lifecycle, direction: 'next' | 'previous'): Lifecycle => {
  const index = Option.getOrElse(
    A.findFirstIndex(lifecycles, (lifecycle) => lifecycle === current),
    () => 0,
  )
  const nextIndex =
    direction === 'next'
      ? (index + 1) % lifecycles.length
      : (index - 1 + lifecycles.length) % lifecycles.length
  return A.getUnsafe(lifecycles, nextIndex)
}

const nextFocusPane = (current: FocusPane): FocusPane =>
  A.getUnsafe(
    focusOrder,
    (Option.getOrElse(
      A.findFirstIndex(focusOrder, (pane) => pane === current),
      () => 0,
    ) +
      1) %
      focusOrder.length,
  )

const moveCursor = (cursor: number, size: number, direction: 'next' | 'previous'): number => {
  if (size <= 0) return 0
  return direction === 'next' ? (cursor + 1) % size : (cursor - 1 + size) % size
}

const clampCursor = (cursor: number, size: number): number => {
  if (size <= 0) return 0
  return Math.min(cursor, size - 1)
}

const getWorkspaceValue = (state: DashboardState): WorkspaceContext | null =>
  state.workspace._tag === 'Ready' ? state.workspace.value : null

const beginPlanBuild = (
  state: DashboardState,
  workspace: WorkspaceContext,
  lifecycle: Lifecycle,
  excludedPackages: readonly string[],
): Tui.ProgramTransition<DashboardState, DashboardCommand> => {
  const planRequestSeq = state.planRequestSeq + 1
  return Tui.Transition.command(
    {
      ...state,
      lifecycle,
      excludedPackages,
      plan: loading(),
      doctor: idle(),
      planRequestSeq,
      message: `Building ${lifecycle} plan...`,
    },
    {
      _tag: 'BuildPlan',
      requestId: planRequestSeq,
      workspace,
      lifecycle,
      excludedPackages,
    },
  )
}

export const dashboardUpdate = (
  state: DashboardState,
  action: DashboardAction,
): Tui.ProgramTransition<DashboardState, DashboardCommand> => {
  switch (action._tag) {
    case 'FocusAdvanced':
      return Tui.Transition.next({ ...state, focusPane: nextFocusPane(state.focusPane) })
    case 'HelpDismissed':
      return Tui.Transition.next({ ...state, showHelp: false })
    case 'HelpToggled':
      return Tui.Transition.next({ ...state, showHelp: !state.showHelp })
    case 'LifecycleStepped': {
      const workspace = getWorkspaceValue(state)
      if (workspace === null) return Tui.Transition.next(state)
      const lifecycle = nextLifecycle(state.lifecycle, action.direction)
      return beginPlanBuild(state, workspace, lifecycle, state.excludedPackages)
    }
    case 'PackageCursorMoved': {
      const workspace = getWorkspaceValue(state)
      if (workspace === null || state.focusPane !== 'packages') return Tui.Transition.next(state)
      return Tui.Transition.next({
        ...state,
        packageCursor: moveCursor(
          state.packageCursor,
          workspace.uiPackages.length,
          action.direction,
        ),
      })
    }
    case 'PackageToggled': {
      const workspace = getWorkspaceValue(state)
      if (workspace === null) return Tui.Transition.next(state)
      const current = Option.getOrUndefined(A.get(workspace.uiPackages, state.packageCursor))
      if (!current) return Tui.Transition.next(state)
      const excludedPackages = A.contains(state.excludedPackages, current.scope)
        ? A.filter(state.excludedPackages, (scope) => scope !== current.scope)
        : A.append(state.excludedPackages, current.scope)
      return beginPlanBuild(state, workspace, state.lifecycle, excludedPackages)
    }
    case 'PersistFailed':
      return Tui.Transition.next({ ...state, message: `Persist failed: ${action.message}` })
    case 'PersistRequested': {
      if (state.plan._tag !== 'Ready') {
        return Tui.Transition.next({ ...state, message: 'Nothing to persist.' })
      }
      return Tui.Transition.command(
        {
          ...state,
          message:
            state.plan.value.plannedPackages === 0
              ? 'Clearing persisted plan...'
              : 'Persisting draft...',
        },
        {
          _tag: 'PersistPlan',
          clear: state.plan.value.plannedPackages === 0,
          plan: state.plan.value.plan,
        },
      )
    }
    case 'PersistSucceeded': {
      const workspaceRequestSeq = state.workspaceRequestSeq + 1
      if (state.workspace._tag !== 'Ready') {
        return Tui.Transition.command(
          {
            ...state,
            workspaceRequestSeq,
            message: action.cleared ? 'Cleared the plan.' : 'Persisted the draft.',
          },
          { _tag: 'LoadWorkspace', requestId: workspaceRequestSeq },
        )
      }
      return Tui.Transition.command(
        {
          ...state,
          workspaceRequestSeq,
          message: action.cleared ? 'Cleared the plan.' : 'Persisted the draft.',
          workspace: { ...state.workspace, refreshing: true },
        },
        { _tag: 'LoadWorkspace', requestId: workspaceRequestSeq },
      )
    }
    case 'PlanBuildFailed':
      // Stale: a newer BuildPlan has been issued since this one. Discard.
      if (action.requestId !== state.planRequestSeq) return Tui.Transition.next(state)
      return Tui.Transition.next({
        ...state,
        plan: failure(action.message),
        doctor: idle(),
        message: `Plan error: ${action.message}`,
      })
    case 'PlanBuilt': {
      // Stale: a newer BuildPlan has been issued since this one. Discard
      // entirely — applying it would stomp the in-flight latest request's
      // state with stale draft data (the bug surfaced by forking commands
      // off the dispatch lock).
      if (action.requestId !== state.planRequestSeq) return Tui.Transition.next(state)
      const workspace = getWorkspaceValue(state)
      const shouldBuildDoctor = action.draft.plannedPackages > 0
      const doctorRequestSeq =
        workspace !== null && shouldBuildDoctor
          ? state.doctorRequestSeq + 1
          : state.doctorRequestSeq
      const nextState: DashboardState = {
        ...state,
        plan: ready(action.draft),
        doctor:
          action.draft.plannedPackages === 0
            ? ready('Doctor skipped — no planned packages.')
            : loading(),
        doctorRequestSeq,
        message: `${state.lifecycle} plan: ${action.draft.plannedPackages} packages.`,
      }
      if (workspace === null || !shouldBuildDoctor) {
        return Tui.Transition.next(nextState)
      }
      return Tui.Transition.command(nextState, {
        _tag: 'BuildDoctor',
        requestId: doctorRequestSeq,
        workspace,
        plan: action.draft.plan,
      })
    }
    case 'QuitRequested':
      return Tui.Transition.command(state, { _tag: 'Quit' })
    case 'RefreshRequested': {
      const workspaceRequestSeq = state.workspaceRequestSeq + 1
      return Tui.Transition.command(
        {
          ...state,
          workspaceRequestSeq,
          message: 'Refreshing...',
          workspace:
            state.workspace._tag === 'Ready'
              ? { ...state.workspace, refreshing: true }
              : { _tag: 'Loading' },
        },
        { _tag: 'LoadWorkspace', requestId: workspaceRequestSeq },
      )
    }
    case 'WorkspaceLoadFailed':
      // Stale: a newer LoadWorkspace has been issued since this one. Discard.
      if (action.requestId !== state.workspaceRequestSeq) return Tui.Transition.next(state)
      if (state.workspace._tag === 'Ready') {
        return Tui.Transition.next({
          ...state,
          workspace: { ...state.workspace, refreshing: false },
          message: `Workspace error: ${action.message}`,
        })
      }
      return Tui.Transition.next({
        ...state,
        workspace: { _tag: 'Failure', message: action.message },
        message: `Workspace error: ${action.message}`,
      })
    case 'WorkspaceLoaded': {
      // Stale: a newer LoadWorkspace has been issued since this one. Discard.
      if (action.requestId !== state.workspaceRequestSeq) return Tui.Transition.next(state)
      const workspaceLoads = state.workspaceLoads + 1
      if (action.workspace === null) {
        return Tui.Transition.next({
          ...state,
          workspace: { _tag: 'Ready', value: null, refreshing: false },
          workspaceLoads,
          plan: idle(),
          doctor: idle(),
          packageCursor: 0,
          message: 'No packages found.',
        })
      }
      const workspace = action.workspace
      const lifecycle = state.workspaceLoads === 0 ? workspace.initialLifecycle : state.lifecycle
      const excludedPackages = A.filter(state.excludedPackages, (scope) =>
        A.some(workspace.uiPackages, (pkg) => pkg.scope === scope),
      )
      const planRequestSeq = state.planRequestSeq + 1
      const nextState: DashboardState = {
        ...state,
        lifecycle,
        excludedPackages,
        workspace: { _tag: 'Ready', value: workspace, refreshing: false },
        workspaceLoads,
        packageCursor: clampCursor(state.packageCursor, workspace.uiPackages.length),
        plan: loading(),
        doctor: idle(),
        planRequestSeq,
        message: `Loaded ${workspace.uiPackages.length} packages.`,
      }
      return Tui.Transition.command(nextState, {
        _tag: 'BuildPlan',
        requestId: planRequestSeq,
        workspace,
        lifecycle,
        excludedPackages,
      })
    }
    case 'DoctorBuildFailed':
      // Stale: a newer BuildDoctor has been issued since this one. Discard.
      if (action.requestId !== state.doctorRequestSeq) return Tui.Transition.next(state)
      return Tui.Transition.next({
        ...state,
        doctor: failure(action.message),
        message: `Doctor error: ${action.message}`,
      })
    case 'DoctorBuilt':
      // Stale: a newer BuildDoctor has been issued since this one. Discard.
      if (action.requestId !== state.doctorRequestSeq) return Tui.Transition.next(state)
      return Tui.Transition.next({
        ...state,
        doctor: ready(action.text),
      })
  }
}

export const handleDashboardKey = (
  state: DashboardState,
  event: KeyEvent,
): readonly DashboardAction[] => {
  if (event.sequence === '?' || event.name === '?') {
    return [{ _tag: 'HelpToggled' }]
  }

  if (state.showHelp) {
    if (event.name === 'q' || event.name === 'escape' || (event.name === 'c' && event.ctrl)) {
      return [{ _tag: 'HelpDismissed' }]
    }
    return []
  }

  if (event.name === 'q' || event.name === 'escape' || (event.name === 'c' && event.ctrl)) {
    return [{ _tag: 'QuitRequested' }]
  }
  if (event.sequence === '[' || event.sequence === ']') {
    return [{ _tag: 'LifecycleStepped', direction: event.sequence === ']' ? 'next' : 'previous' }]
  }
  if (event.name === 'tab') {
    return [{ _tag: 'FocusAdvanced' }]
  }
  if (event.name === 'up' || event.name === 'k') {
    return [{ _tag: 'PackageCursorMoved', direction: 'previous' }]
  }
  if (event.name === 'down' || event.name === 'j') {
    return [{ _tag: 'PackageCursorMoved', direction: 'next' }]
  }
  if (event.name === 't' || (event.name === 'return' && state.focusPane === 'packages')) {
    return [{ _tag: 'PackageToggled' }]
  }
  if (event.name === 'p') {
    return [{ _tag: 'PersistRequested' }]
  }
  if (event.name === 'r') {
    return [{ _tag: 'RefreshRequested' }]
  }
  return []
}

export const runDashboardCommand = (
  command: DashboardCommand,
  _state: DashboardState,
): Effect.Effect<readonly DashboardAction[], never, Data | Tui.Control> => {
  switch (command._tag) {
    case 'BuildDoctor': {
      const requestId = command.requestId
      return Effect.gen(function* () {
        const data = yield* Data
        return yield* data.buildDoctorReport(command.workspace, command.plan).pipe(
          Effect.map((text) => actions({ _tag: 'DoctorBuilt', requestId, text })),
          Effect.catch((error) =>
            Effect.succeed(
              actions({ _tag: 'DoctorBuildFailed', requestId, message: toMessage(error) }),
            ),
          ),
        )
      })
    }
    case 'BuildPlan': {
      const requestId = command.requestId
      return Effect.gen(function* () {
        const data = yield* Data
        return yield* data
          .buildPlan(command.workspace, command.lifecycle, command.excludedPackages)
          .pipe(
            Effect.map((plan) => {
              const plannedPackages = plan.releases.length + plan.cascades.length
              return actions({
                _tag: 'PlanBuilt',
                requestId,
                draft: {
                  plan,
                  text: renderPlanText(plan),
                  draftJson: plannedPackages > 0 ? serializePlanJson(plan) : undefined,
                  plannedPackages,
                },
              })
            }),
            Effect.catch((error) =>
              Effect.succeed(
                actions({ _tag: 'PlanBuildFailed', requestId, message: toMessage(error) }),
              ),
            ),
          )
      })
    }
    case 'LoadWorkspace': {
      const requestId = command.requestId
      return Effect.gen(function* () {
        const data = yield* Data
        return yield* data.loadWorkspaceContext.pipe(
          Effect.map((workspace) => actions({ _tag: 'WorkspaceLoaded', requestId, workspace })),
          Effect.catch((error) =>
            Effect.succeed(
              actions({ _tag: 'WorkspaceLoadFailed', requestId, message: toMessage(error) }),
            ),
          ),
        )
      })
    }
    case 'PersistPlan':
      return Effect.gen(function* () {
        const data = yield* Data
        const persist = command.clear ? data.clearPersistedPlan : data.persistPlan(command.plan)
        return yield* persist.pipe(
          Effect.as(actions({ _tag: 'PersistSucceeded', cleared: command.clear })),
          Effect.catch((error) =>
            Effect.succeed(actions({ _tag: 'PersistFailed', message: toMessage(error) })),
          ),
        )
      })
    case 'Quit':
      return Effect.gen(function* () {
        const control = yield* Tui.Control
        yield* control.exit
        return actions()
      })
  }
}
