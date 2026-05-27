import { describe, expect, test } from 'bun:test'
import * as TuiTest from '@kitz/tui/test'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Array as A, Effect, Layer, Option } from 'effect'
import { act } from 'react'
import * as Api from '../../api/__.js'
import { Analysis } from '../../api/analyzer/models/analysis.js'
import { makeCascadeCommit } from '../../api/analyzer/models/commit.js'
import { Official } from '../../api/planner/models/item-official.js'
import { OfficialFirst } from '../../api/version/models/official-first.js'
import { dashboardProgram } from './ui-app.js'
import { Data, type Lifecycle, type WorkspaceContext } from './ui-atoms.js'

const config = Api.Config.ResolvedConfig.make({
  trunk: 'main',
  npmTag: 'latest',
  candidateTag: 'next',
  packages: {},
  publishing: Api.Publishing.defaultPublishing(),
  operator: Api.Operator.ResolvedOperator.make({
    manager: Pkg.Manager.DetectedPackageManager.make({
      name: 'bun',
      source: 'runtime',
    }),
    releaseCommand: 'bun run release',
    prepareCommands: [],
  }),
  resolvedConventionalCommitTypes: Api.Config.resolveConventionalCommitTypes({}),
  lint: Api.Lint.resolveConfig({}),
})

const analysis = Analysis.make({
  impacts: [],
  cascades: [],
  unchanged: [],
  tags: [],
})

const makeWorkspace = (
  scopes: readonly string[] = ['alpha', 'beta'],
  initialLifecycle: Lifecycle = 'official',
  persistedPlanText?: string,
) => ({
  config,
  analysis,
  packages: [],
  uiPackages: A.map(scopes, (scope) => ({ scope, name: `@kitz/${scope}` })),
  currentBranch: 'main',
  diffRemote: 'origin',
  pullRequest: null,
  diff: null,
  persistedPlanPath: '/repo/.release/plan.json',
  persistedPlanLabel: persistedPlanText ? `${initialLifecycle} plan` : 'missing',
  persistedPlanText,
  initialLifecycle,
})

const makeEmptyPlan = (lifecycle: Lifecycle) =>
  Api.Planner.Plan.make({
    lifecycle,
    timestamp: '2026-04-07T00:00:00Z',
    releases: [],
    cascades: [],
  })

const makeOfficialPlan = () =>
  Api.Planner.Plan.make({
    lifecycle: 'official',
    timestamp: '2026-04-07T00:00:00Z',
    releases: [
      Official.make({
        package: {
          name: Pkg.Moniker.parse('@kitz/core'),
          scope: 'core',
          path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
        },
        version: OfficialFirst.make({
          version: Semver.fromString('1.0.0'),
          bump: 'major',
        }),
        commits: [makeCascadeCommit('core', 'feature')],
      }),
    ],
    cascades: [],
  })

const createDataLayer = (options?: {
  readonly workspace?: WorkspaceContext | null
  readonly plans?: Partial<Record<Lifecycle, Api.Planner.Plan>>
}) => {
  const buildPlanCalls: Array<{
    readonly lifecycle: Lifecycle
    readonly excludedPackages: readonly string[]
  }> = []
  const persistedPlans: Api.Planner.Plan[] = []
  let clearedPlans = 0
  const workspace = options?.workspace ?? makeWorkspace()
  const plans = options?.plans ?? {
    official: makeEmptyPlan('official'),
    candidate: makeEmptyPlan('candidate'),
    ephemeral: makeEmptyPlan('ephemeral'),
  }

  const layer = Layer.succeed(Data)({
    loadWorkspaceContext: Effect.succeed(workspace),
    buildPlan: (_workspace, lifecycle, excludedPackages) =>
      Effect.sync(() => {
        buildPlanCalls.push({ lifecycle, excludedPackages })
        return plans[lifecycle] ?? makeEmptyPlan(lifecycle)
      }),
    buildDoctorReport: (_workspace, plan) => Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
    persistPlan: (plan) =>
      Effect.sync(() => {
        persistedPlans.push(plan)
      }),
    clearPersistedPlan: Effect.sync(() => {
      clearedPlans += 1
    }),
  })

  return {
    layer,
    buildPlanCalls,
    persistedPlans,
    get clearedPlans() {
      return clearedPlans
    },
  }
}

describe('ui-app', () => {
  test('loads the dashboard through the shared runtime and renders the empty-plan state', async () => {
    const data = createDataLayer({
      workspace: makeWorkspace(['alpha'], 'candidate'),
    })

    const setup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: data.layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await setup.flush()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Packages')
      expect(frame).toContain('CANDIDATE')
      expect(frame).toContain('> [x]alpha@kitz/alpha')
      expect(frame).toContain('Doctor skipped')
      expect(frame).toContain('draft')
      expect(frame).toContain('compare.')
      expect(data.buildPlanCalls[0]).toEqual({ lifecycle: 'candidate', excludedPackages: [] })
    } finally {
      setup.renderer.destroy()
    }
  })

  test('supports package toggling, lifecycle cycling, help dismissal, and quit', async () => {
    const data = createDataLayer({
      workspace: makeWorkspace(['alpha', 'beta'], 'official'),
    })

    const setup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: data.layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await setup.flush()
      })

      await act(async () => {
        setup.mockInput.pressKey('t')
        await setup.flush()
      })
      expect(Option.getOrThrow(A.last(data.buildPlanCalls))).toEqual({
        lifecycle: 'official',
        excludedPackages: ['alpha'],
      })
      expect(setup.captureCharFrame()).toContain('> [ ]alpha')

      await act(async () => {
        setup.mockInput.pressKey(']')
        await setup.flush()
      })
      expect(Option.getOrThrow(A.last(data.buildPlanCalls))).toEqual({
        lifecycle: 'candidate',
        excludedPackages: ['alpha'],
      })

      await act(async () => {
        setup.mockInput.pressKey('?')
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('Help (press ? to close)')

      await act(async () => {
        setup.mockInput.pressKey('q')
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('Packages')

      const destroyed = new Promise((resolve) => {
        setup.renderer.once('destroy', () => resolve(undefined))
      })

      await act(async () => {
        setup.mockInput.pressKey('q')
      })
      await destroyed
    } finally {
      setup.renderer.destroy()
    }
  })

  test('clears persisted state for empty plans and persists non-empty plans', async () => {
    const emptyData = createDataLayer({
      workspace: makeWorkspace(['alpha'], 'official'),
      plans: { official: makeEmptyPlan('official') },
    })

    const emptySetup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: emptyData.layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await emptySetup.flush()
      })
      await act(async () => {
        emptySetup.mockInput.pressKey('p')
        await emptySetup.flush()
      })

      expect(emptyData.clearedPlans).toBe(1)
    } finally {
      emptySetup.renderer.destroy()
    }

    const fullData = createDataLayer({
      workspace: makeWorkspace(['core'], 'official'),
      plans: { official: makeOfficialPlan() },
    })

    const fullSetup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: fullData.layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await fullSetup.flush()
      })
      expect(fullSetup.captureCharFrame()).toContain('Doctor summary for official')

      await act(async () => {
        fullSetup.mockInput.pressKey('p')
        await fullSetup.flush()
      })

      expect(fullData.persistedPlans).toHaveLength(1)
      expect(fullData.persistedPlans[0]?.releases).toHaveLength(1)
    } finally {
      fullSetup.renderer.destroy()
    }
  })

  // Snapshot tests at fixed widths catch visual regressions: panel-width math
  // bugs, text overflow, color-code drift, alignment changes. They lock in
  // the structural shape of the rendered frame at common terminal widths.
  // Update via `bun test --update-snapshots` after intentional UI changes.
  for (const width of [80, 100, 140] as const) {
    test(`dashboard renders consistently at width=${width}`, async () => {
      const data = createDataLayer({
        workspace: makeWorkspace(['core', 'cli'], 'official'),
      })

      const setup = await TuiTest.renderProgram(
        { spec: dashboardProgram, layer: data.layer },
        { width, height: 30 },
      )

      try {
        await act(async () => {
          await setup.flush()
        })

        expect(setup.captureCharFrame()).toMatchSnapshot()
      } finally {
        setup.renderer.destroy()
      }
    })
  }

  // Baseline: j moves the cursor down once the workspace is loaded. This
  // pins down `event.name === 'j'` dispatching to PackageCursorMoved so the
  // P0 input-latency regression below can't pass for the wrong reason
  // (e.g. the keypress silently failing to dispatch).
  test('j key moves cursor after boot completes', async () => {
    const data = createDataLayer({
      workspace: makeWorkspace(['alpha', 'beta'], 'official'),
    })
    const setup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: data.layer },
      { width: 100, height: 30 },
    )
    try {
      await act(async () => {
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('> [x]alpha')

      await act(async () => {
        setup.mockInput.pressKey('j')
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('> [x] beta')
    } finally {
      setup.renderer.destroy()
    }
  })

  // P0 input-latency regression. The release TUI's initial `LoadWorkspace`
  // command currently runs inside the dispatch lock, blocking ALL other
  // dispatches — including keypresses — until the entire boot chain
  // (LoadWorkspace → WorkspaceLoaded → BuildPlan → PlanBuilt) completes. In
  // production that's ~5s of git + fs + github + plan-store calls; this test
  // simulates it with a 200ms sleep.
  //
  // The user-visible symptom is "press j during boot, nothing happens, then
  // cursor jumps multiple positions at once": the j press queues on the lock,
  // then replays against the now-Ready workspace.
  //
  // The structural fix is to fork commands off the dispatch lock so the j
  // press can dispatch immediately. With workspace still Loading, the
  // cursor-move action is a no-op (PackageCursorMoved bails when workspace
  // is null in ui-model.ts) — the CORRECT behaviour is for the cursor to
  // STAY AT 0, not advance to 1 after the boot completes.
  //
  // The assertion targets controller STATE (via a wrapper around `update`)
  // rather than the rendered frame. The frame is unreliable here because the
  // SubscriptionRef → notify → React-commit chain runs on the infra stream
  // fiber that `settled()` does not await — so a frame captured immediately
  // after settle can lag the underlying state. Tracking state directly
  // sidesteps this entirely and gives a deterministic green/red signal.
  test('P0: j pressed during initial workspace load does not queue and replay', async () => {
    const workspace = makeWorkspace(['alpha', 'beta'], 'official')
    const layer = Layer.succeed(Data)({
      loadWorkspaceContext: Effect.sleep('200 millis').pipe(Effect.as(workspace)),
      buildPlan: (_workspace, lifecycle) => Effect.succeed(makeEmptyPlan(lifecycle)),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    // Wrapper spec that captures every (action, resulting-state) pair seen by
    // `update`. The last entry's resulting state is the source of truth for
    // the assertion below.
    type Action = Parameters<typeof dashboardProgram.update>[1]
    type State = Parameters<typeof dashboardProgram.update>[0]
    const updateLog: Array<{ readonly action: Action; readonly nextState: State }> = []
    const trackedProgram = {
      ...dashboardProgram,
      update: (state: State, action: Action) => {
        const transition = dashboardProgram.update(state, action)
        updateLog.push({ action, nextState: transition.state })
        return transition
      },
    }

    const setup = await TuiTest.renderProgram(
      { spec: trackedProgram, layer },
      { width: 100, height: 30 },
    )

    try {
      // Wait long enough that the boot fiber has DEFINITELY started, acquired
      // the dispatch lock, called spec.run, entered loadWorkspaceContext, and
      // suspended on Effect.sleep('200 millis'). 50ms is plenty for that
      // chain (React useEffect → start() → forkWork → fiber scheduling).
      await new Promise<void>((resolve) => setTimeout(resolve, 50))

      // Confirm boot is genuinely in flight at the moment we press j.
      // If this assertion fails, the test setup itself is wrong (boot
      // completed too early) and the rest is meaningless.
      await setup.renderOnce()
      expect(setup.captureCharFrame()).toContain('Loading workspace...')

      // Press j WHILE workspace is still Loading.
      setup.mockInput.pressKey('j')

      // Drain everything (boot + j-press fiber, in whatever order they
      // complete). With the bug: boot eventually releases the lock with
      // workspace Ready, then the queued j-dispatch acquires the lock and
      // moves the cursor to 1. With the fix: the j-dispatch acquires the
      // lock briefly, sees workspace Loading, no-ops, releases the lock.
      await act(async () => {
        await setup.flush()
      })

      // Verify the dispatch actually happened — `j` produced PackageCursorMoved.
      const cursorActions = updateLog.filter((e) => e.action._tag === 'PackageCursorMoved')
      expect(cursorActions).toHaveLength(1)

      // The state seen at the moment PackageCursorMoved was processed reveals
      // whether the bug manifested:
      //   - BUG: workspace was Ready → cursor moved to 1 (replay symptom)
      //   - FIX: workspace was Loading → cursor stayed at 0 (no-op)
      const finalEntry = updateLog[updateLog.length - 1]
      expect(finalEntry).toBeDefined()
      expect(finalEntry!.nextState.packageCursor).toBe(0)
    } finally {
      setup.renderer.destroy()
    }
  })

  // Phase 4 QA — additional scenarios where the lock-during-commands bug
  // would have manifested as user-visible unresponsiveness during boot.

  test('Phase 4: multiple j presses during boot do not accumulate and replay', async () => {
    const workspace = makeWorkspace(['a', 'b', 'c', 'd', 'e'], 'official')
    const layer = Layer.succeed(Data)({
      loadWorkspaceContext: Effect.sleep('200 millis').pipe(Effect.as(workspace)),
      buildPlan: (_workspace, lifecycle) => Effect.succeed(makeEmptyPlan(lifecycle)),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    type Action = Parameters<typeof dashboardProgram.update>[1]
    type State = Parameters<typeof dashboardProgram.update>[0]
    const updateLog: Array<{ readonly action: Action; readonly nextState: State }> = []
    const trackedProgram = {
      ...dashboardProgram,
      update: (state: State, action: Action) => {
        const transition = dashboardProgram.update(state, action)
        updateLog.push({ action, nextState: transition.state })
        return transition
      },
    }

    const setup = await TuiTest.renderProgram(
      { spec: trackedProgram, layer },
      { width: 100, height: 30 },
    )

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))

      // Press j three times during boot. With the bug, all three would
      // queue and replay against the Ready workspace, advancing the cursor
      // to index 3 (d). With the fix, all three no-op and cursor stays at 0.
      setup.mockInput.pressKey('j')
      setup.mockInput.pressKey('j')
      setup.mockInput.pressKey('j')

      await act(async () => {
        await setup.flush()
      })

      const cursorActions = updateLog.filter((e) => e.action._tag === 'PackageCursorMoved')
      expect(cursorActions).toHaveLength(3)

      const finalEntry = updateLog[updateLog.length - 1]
      expect(finalEntry).toBeDefined()
      // Cursor must remain at 0 — the multi-jump symptom is the visible
      // form of the lock-blocking bug.
      expect(finalEntry!.nextState.packageCursor).toBe(0)
    } finally {
      setup.renderer.destroy()
    }
  })

  test('Phase 4: ? toggle during boot is responsive', async () => {
    const workspace = makeWorkspace(['alpha'], 'official')
    const layer = Layer.succeed(Data)({
      loadWorkspaceContext: Effect.sleep('200 millis').pipe(Effect.as(workspace)),
      buildPlan: (_workspace, lifecycle) => Effect.succeed(makeEmptyPlan(lifecycle)),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    type Action = Parameters<typeof dashboardProgram.update>[1]
    type State = Parameters<typeof dashboardProgram.update>[0]
    const updateLog: Array<{ readonly action: Action; readonly nextState: State }> = []
    const trackedProgram = {
      ...dashboardProgram,
      update: (state: State, action: Action) => {
        const transition = dashboardProgram.update(state, action)
        updateLog.push({ action, nextState: transition.state })
        return transition
      },
    }

    const setup = await TuiTest.renderProgram(
      { spec: trackedProgram, layer },
      { width: 100, height: 30 },
    )

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      // Press ? during boot. This action is NOT gated on workspace state,
      // so it should toggle showHelp regardless of when it dispatches.
      setup.mockInput.pressKey('?')

      await act(async () => {
        await setup.flush()
      })

      const helpToggles = updateLog.filter((e) => e.action._tag === 'HelpToggled')
      expect(helpToggles).toHaveLength(1)
      const finalEntry = updateLog[updateLog.length - 1]
      expect(finalEntry).toBeDefined()
      // showHelp must be true — the ? press dispatched and updated state,
      // regardless of boot timing.
      expect(finalEntry!.nextState.showHelp).toBe(true)
    } finally {
      setup.renderer.destroy()
    }
  })

  test('Phase 4: q pressed during boot exits cleanly without waiting for boot', async () => {
    const workspace = makeWorkspace(['alpha'], 'official')
    const layer = Layer.succeed(Data)({
      // Long boot — if q has to wait for it, the test will time out.
      loadWorkspaceContext: Effect.sleep('1000 millis').pipe(Effect.as(workspace)),
      buildPlan: (_workspace, lifecycle) => Effect.succeed(makeEmptyPlan(lifecycle)),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    const setup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer },
      { width: 100, height: 30 },
    )

    const destroyed = new Promise<void>((resolve) => {
      setup.renderer.once('destroy', () => resolve())
    })

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      // Press q during boot. With the bug, this would block on the lock
      // until the 1000ms boot completes. With the fix, the Quit command
      // forks off the lock and destroys the renderer immediately.
      const startedWaiting = Date.now()
      setup.mockInput.pressKey('q')
      await destroyed
      const elapsed = Date.now() - startedWaiting

      // Should have destroyed well within 500ms (much less than the 1000ms
      // boot). Any value above ~500ms indicates the lock is still holding
      // q hostage, which is the bug.
      expect(elapsed).toBeLessThan(500)
    } catch {
      setup.renderer.destroy()
      throw new Error('q during boot did not destroy the renderer in time')
    }
  })

  // Regression for the race the Phase-2 lock-fix surfaces: with commands
  // forked off the dispatch lock, two BuildPlans can run in parallel. If
  // the EARLIER-issued one happens to take longer (slow git, retry, etc.)
  // and lands its PlanBuilt AFTER the LATER-issued one, the stale draft
  // overwrites the fresh one and the user sees a plan that doesn't match
  // the visible exclusion/lifecycle state. The fix is request-generation
  // tokens on BuildPlan/PlanBuilt; the handler discards stale results.
  test('Phase 4: stale BuildPlan response does not overwrite a newer one', async () => {
    const workspace = makeWorkspace(['alpha'], 'official')

    // The test sequence is:
    //   1. boot triggers BuildPlan(official) — instant
    //   2. user presses ']' → BuildPlan(candidate) — slow (200ms)
    //   3. user presses ']' → BuildPlan(ephemeral) — fast (50ms)
    // Because (3) is faster than (2), PlanBuilt(ephemeral) lands FIRST then
    // PlanBuilt(candidate) lands second. Without the fix, the candidate
    // plan stomps the ephemeral plan in state.
    const layer = Layer.succeed(Data)({
      loadWorkspaceContext: Effect.succeed(workspace),
      buildPlan: (_workspace, lifecycle, _excludedPackages) =>
        Effect.gen(function* () {
          if (lifecycle === 'candidate') yield* Effect.sleep('200 millis')
          else if (lifecycle === 'ephemeral') yield* Effect.sleep('50 millis')
          return makeEmptyPlan(lifecycle)
        }),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    type Action = Parameters<typeof dashboardProgram.update>[1]
    type State = Parameters<typeof dashboardProgram.update>[0]
    const updateLog: Array<{ readonly action: Action; readonly nextState: State }> = []
    const trackedProgram = {
      ...dashboardProgram,
      update: (state: State, action: Action) => {
        const transition = dashboardProgram.update(state, action)
        updateLog.push({ action, nextState: transition.state })
        return transition
      },
    }

    const setup = await TuiTest.renderProgram(
      { spec: trackedProgram, layer },
      { width: 100, height: 30 },
    )

    try {
      // Wait for boot's BuildPlan(official) to complete.
      await act(async () => {
        await setup.flush()
      })

      // Step lifecycle: official → candidate. BuildPlan(candidate) starts a
      // 200ms sleep.
      setup.mockInput.pressKey(']')

      // Give BuildPlan(candidate) time to begin sleeping. ~20ms is enough for
      // the keypress to propagate, dispatch, fork, and enter the sleep — well
      // short of the 200ms total.
      await new Promise<void>((resolve) => setTimeout(resolve, 20))

      // Step lifecycle: candidate → ephemeral. BuildPlan(ephemeral) starts a
      // 50ms sleep. Will COMPLETE before BuildPlan(candidate).
      setup.mockInput.pressKey(']')

      // Drain everything (waits for both BuildPlans to complete).
      await act(async () => {
        await setup.flush()
      })

      const finalEntry = updateLog[updateLog.length - 1]
      expect(finalEntry).toBeDefined()
      const finalState = finalEntry!.nextState

      // The user-driven state changes are unambiguous (handled serially under
      // the dispatch lock).
      expect(finalState.lifecycle).toBe('ephemeral')
      expect(finalState.plan._tag).toBe('Ready')

      // The crucial assertion: the visible plan must reflect the LATEST
      // request (ephemeral), not the older (candidate) that just happened to
      // resolve later.
      if (finalState.plan._tag === 'Ready') {
        expect(finalState.plan.value.plan.lifecycle).toBe('ephemeral')
      }
    } finally {
      setup.renderer.destroy()
    }
  })

  test('Phase 4: LoadWorkspace failure renders error state', async () => {
    const layer = Layer.succeed(Data)({
      loadWorkspaceContext: Effect.fail(
        new Git.GitError({
          context: { operation: 'getRoot', detail: 'git fetch exploded' },
          cause: new Error('git fetch exploded'),
        }),
      ),
      buildPlan: (_workspace, lifecycle) => Effect.succeed(makeEmptyPlan(lifecycle)),
      buildDoctorReport: (_workspace, plan) =>
        Effect.succeed(`Doctor summary for ${plan.lifecycle}`),
      persistPlan: (_plan) => Effect.sync(() => {}),
      clearPersistedPlan: Effect.sync(() => {}),
    })

    type Action = Parameters<typeof dashboardProgram.update>[1]
    type State = Parameters<typeof dashboardProgram.update>[0]
    const updateLog: Array<{ readonly action: Action; readonly nextState: State }> = []
    const trackedProgram = {
      ...dashboardProgram,
      update: (state: State, action: Action) => {
        const transition = dashboardProgram.update(state, action)
        updateLog.push({ action, nextState: transition.state })
        return transition
      },
    }

    const setup = await TuiTest.renderProgram(
      { spec: trackedProgram, layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await setup.flush()
      })

      const finalEntry = updateLog[updateLog.length - 1]
      expect(finalEntry).toBeDefined()
      expect(finalEntry!.nextState.workspace._tag).toBe('Failure')
      // Frame should show the error message rather than spinning forever.
      const frame = setup.captureCharFrame()
      expect(frame).toContain('git fetch exploded')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('dashboard renders the help overlay consistently', async () => {
    const data = createDataLayer({
      workspace: makeWorkspace(['core'], 'official'),
    })

    const setup = await TuiTest.renderProgram(
      { spec: dashboardProgram, layer: data.layer },
      { width: 100, height: 30 },
    )

    try {
      await act(async () => {
        await setup.flush()
      })

      await act(async () => {
        setup.mockInput.pressKey('?')
        await setup.flush()
      })

      expect(setup.captureCharFrame()).toMatchSnapshot()
    } finally {
      setup.renderer.destroy()
    }
  })
})
