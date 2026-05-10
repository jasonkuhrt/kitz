import { describe, expect, test } from 'bun:test'
import * as TuiTest from '@kitz/tui/test'
import { Fs } from '@kitz/fs'
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
