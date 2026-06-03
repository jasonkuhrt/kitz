import type { KeyEvent } from '@opentui/core'
import { Pkg } from '@kitz/pkg'
import { Array as A } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as Api from '../../api/__.js'
import { Analysis } from '../../api/analyzer/models/analysis.js'
import {
  dashboardUpdate,
  handleDashboardKey,
  initialDashboardState,
  type DashboardState,
} from './ui-model.js'
import type { Lifecycle } from './ui-atoms.js'

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
  commitOverrides: {},
  lint: Api.Lint.resolveConfig({}),
})

const analysis = Analysis.make({
  impacts: [],
  cascades: [],
  unchanged: [],
  tags: [],
})

const keyEvent = (overrides: Partial<KeyEvent>): KeyEvent =>
  ({
    name: '',
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: '',
    number: false,
    raw: '',
    eventType: 'press',
    source: 'raw',
    preventDefault() {},
    stopPropagation() {},
    defaultPrevented: false,
    propagationStopped: false,
    ...overrides,
  }) as KeyEvent

const makeWorkspace = (
  scopes: readonly string[] = ['alpha', 'beta'],
  initialLifecycle: Lifecycle = 'official',
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
  persistedPlanLabel: 'missing',
  persistedPlanText: undefined,
  initialLifecycle,
})

describe('ui-model', () => {
  test('dismisses help instead of quitting when the overlay is open', () => {
    const state: DashboardState = { ...initialDashboardState, showHelp: true }

    expect(handleDashboardKey(state, keyEvent({ name: 'q', sequence: 'q' }))).toEqual([
      { _tag: 'HelpDismissed' },
    ])
    expect(handleDashboardKey(state, keyEvent({ name: 'x', sequence: 'x' }))).toEqual([])
  })

  test('uses the workspace lifecycle on the first successful load', () => {
    const workspace = makeWorkspace(['alpha'], 'candidate')

    const transition = dashboardUpdate(initialDashboardState, {
      _tag: 'WorkspaceLoaded',
      // requestId 0 matches initialDashboardState.workspaceRequestSeq.
      requestId: 0,
      workspace,
    })

    expect(transition.state.lifecycle).toBe('candidate')
    expect(transition.state.workspaceLoads).toBe(1)
    expect(transition.commands).toEqual([
      {
        _tag: 'BuildPlan',
        // The handler increments planRequestSeq from 0 to 1 when issuing
        // the follow-up BuildPlan.
        requestId: 1,
        workspace,
        lifecycle: 'candidate',
        excludedPackages: [],
      },
    ])
  })

  test('preserves the selected lifecycle on refresh and clamps excluded packages to the new workspace', () => {
    const oldWorkspace = makeWorkspace(['alpha', 'beta'], 'official')
    const newWorkspace = makeWorkspace(['beta'], 'candidate')
    const state: DashboardState = {
      ...initialDashboardState,
      lifecycle: 'ephemeral',
      excludedPackages: ['alpha', 'beta'],
      packageCursor: 1,
      workspaceLoads: 1,
      workspace: { _tag: 'Ready', value: oldWorkspace, refreshing: true },
    }

    const transition = dashboardUpdate(state, {
      _tag: 'WorkspaceLoaded',
      // requestId 0 matches state.workspaceRequestSeq inherited from
      // initialDashboardState.
      requestId: 0,
      workspace: newWorkspace,
    })

    expect(transition.state.lifecycle).toBe('ephemeral')
    expect(transition.state.excludedPackages).toEqual(['beta'])
    expect(transition.state.packageCursor).toBe(0)
    expect(transition.commands).toEqual([
      {
        _tag: 'BuildPlan',
        requestId: 1,
        workspace: newWorkspace,
        lifecycle: 'ephemeral',
        excludedPackages: ['beta'],
      },
    ])
  })

  test('reports when there is nothing to persist', () => {
    const transition = dashboardUpdate(initialDashboardState, { _tag: 'PersistRequested' })

    expect(transition.state.message).toBe('Nothing to persist.')
    expect(transition.commands).toEqual([])
  })

  test('skips doctor when a rebuilt plan has no planned packages', () => {
    const workspace = makeWorkspace(['alpha'], 'official')
    const state: DashboardState = {
      ...initialDashboardState,
      workspace: { _tag: 'Ready', value: workspace, refreshing: false },
      plan: { _tag: 'Loading' },
      doctor: { _tag: 'Idle' },
    }

    const transition = dashboardUpdate(state, {
      _tag: 'PlanBuilt',
      // requestId 0 matches state.planRequestSeq inherited from
      // initialDashboardState.
      requestId: 0,
      draft: {
        plan: Api.Planner.Plan.make({
          lifecycle: 'official',
          timestamp: '2026-04-07T00:00:00Z',
          releases: [],
          cascades: [],
        }),
        text: 'No releases planned.',
        draftJson: undefined,
        plannedPackages: 0,
      },
    })

    expect(transition.state.doctor).toEqual({
      _tag: 'Ready',
      value: 'Doctor skipped — no planned packages.',
    })
    expect(transition.commands).toEqual([])
  })
})
