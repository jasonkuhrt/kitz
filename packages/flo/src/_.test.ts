import { Test } from '@kitz/test'
import { MutableHashMap, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Flo from './__.js'

// ─── Event Helpers ─────────────────────────────────────────────

type Event =
  | Flo.Activity.Started
  | Flo.Activity.Completed
  | Flo.Activity.Failed
  | Flo.WorkflowEvent.Completed

const started = (activity: string): Flo.Activity.Started =>
  Flo.Activity.Started.make({ activity, timestamp: new Date(), resumed: false })

const completed = (activity: string): Flo.Activity.Completed =>
  Flo.Activity.Completed.make({ activity, timestamp: new Date(), durationMs: 100, resumed: false })

const failed = (activity: string, error: string): Flo.Activity.Failed =>
  Flo.Activity.Failed.make({ activity, timestamp: new Date(), error })

// ─── List Mode ─────────────────────────────────────────────────

type ListConfig = {
  activities: string[]
  colors?: boolean
  events?: Event[]
}

const renderList = (config: ListConfig): string => {
  const renderer = Flo.Viz.Renderer.create({
    activities: config.activities,
    colors: config.colors ?? false,
  })
  for (const event of config.events ?? []) {
    renderer.update(event)
  }
  return renderer.render()
}

const defaultActivities = ['Preflight', 'Publish:core', 'Publish:flo', 'CreateTag', 'PushTags']

Test.describe('Renderer > list mode')
  .on(renderList)
  .snapshots({ arguments: false })
  .casesInput(
    // Initial state
    { activities: defaultActivities },
    // One running
    { activities: defaultActivities, events: [started('Preflight')] },
    // First completed, second running
    {
      activities: defaultActivities,
      events: [started('Preflight'), completed('Preflight'), started('Publish:core')],
    },
    // All completed
    {
      activities: defaultActivities,
      events: defaultActivities.flatMap((a) => [started(a), completed(a)]),
    },
    // With failure
    {
      activities: defaultActivities,
      events: [
        started('Preflight'),
        completed('Preflight'),
        started('Publish:core'),
        failed('Publish:core', 'npm publish failed'),
      ],
    },
    // With colors
    {
      activities: ['Step1', 'Step2', 'Step3'],
      colors: true,
      events: [started('Step1'), completed('Step1'), started('Step2')],
    },
  )
  .test()

// ─── DAG Mode (Compact) ────────────────────────────────────────

type DagConfig = {
  layers: readonly (readonly string[])[]
  edges?: readonly (readonly [string, string])[]
  colors?: boolean
  events?: Event[]
}

const renderDag = (config: DagConfig): string => {
  const renderer = Flo.Viz.Renderer.create({
    mode: 'dag',
    layers: config.layers,
    edges: config.edges,
    colors: config.colors ?? false,
  })
  for (const event of config.events ?? []) {
    renderer.update(event)
  }
  return renderer.render()
}

const diamondLayers: readonly (readonly string[])[] = [
  ['Preflight'],
  ['Publish:A', 'Publish:B'],
  ['CreateTag'],
]

const diamondEdges: readonly (readonly [string, string])[] = [
  ['Preflight', 'Publish:A'],
  ['Preflight', 'Publish:B'],
  ['Publish:A', 'CreateTag'],
  ['Publish:B', 'CreateTag'],
]

Test.describe('Renderer > DAG mode > compact')
  .on(renderDag)
  .snapshots({ arguments: false })
  .casesInput(
    // Initial state
    { layers: diamondLayers, edges: diamondEdges },
    // First layer running
    { layers: diamondLayers, edges: diamondEdges, events: [started('Preflight')] },
    // First done, second concurrent
    {
      layers: diamondLayers,
      edges: diamondEdges,
      events: [
        started('Preflight'),
        completed('Preflight'),
        started('Publish:A'),
        started('Publish:B'),
      ],
    },
    // All completed
    {
      layers: diamondLayers,
      edges: diamondEdges,
      events: diamondLayers.flat().flatMap((a) => [started(a), completed(a)]),
    },
    // With failure in concurrent layer
    {
      layers: diamondLayers,
      edges: diamondEdges,
      events: [
        started('Preflight'),
        completed('Preflight'),
        started('Publish:A'),
        started('Publish:B'),
        completed('Publish:A'),
        failed('Publish:B', 'publish failed'),
      ],
    },
    // With colors
    {
      layers: diamondLayers,
      edges: diamondEdges,
      colors: true,
      events: [started('Preflight'), completed('Preflight'), started('Publish:A')],
    },
  )
  .test()

// ─── DAG Mode (Full Box Drawing) ───────────────────────────────

const renderDagFull = (config: DagConfig): string => {
  const renderer = Flo.Viz.Renderer.create({
    mode: 'dag',
    layers: config.layers,
    edges: config.edges,
    colors: config.colors ?? false,
  })
  for (const event of config.events ?? []) {
    renderer.update(event)
  }
  return renderer.renderFull()
}

const boxLayers: readonly (readonly string[])[] = [
  ['StepA'],
  ['StepB', 'StepC'],
  ['StepD'],
]

const boxEdges: readonly (readonly [string, string])[] = [
  ['StepA', 'StepB'],
  ['StepA', 'StepC'],
  ['StepB', 'StepD'],
  ['StepC', 'StepD'],
]

Test.describe('Renderer > DAG mode > full')
  .on(renderDagFull)
  .snapshots({ arguments: false })
  .casesInput(
    // Initial state
    { layers: boxLayers, edges: boxEdges },
    // With progress
    {
      layers: boxLayers,
      edges: boxEdges,
      events: [started('StepA'), completed('StepA'), started('StepB'), started('StepC')],
    },
    // With colors
    {
      layers: boxLayers,
      edges: boxEdges,
      colors: true,
      events: [started('StepA'), completed('StepA'), started('StepB')],
    },
  )
  .test()

// ─── Complex DAG ───────────────────────────────────────────────

const complexLayers: readonly (readonly string[])[] = [
  ['Preflight'],
  ['Publish:@kitz/core', 'Publish:@kitz/flo', 'Publish:@kitz/syn'],
  ['CreateTag'],
  ['PushTags'],
]

Test.describe('Renderer > complex DAG')
  .on(renderDag)
  .snapshots({ arguments: false })
  .casesInput(
    // Initial state
    { layers: complexLayers },
    // Mid-execution
    {
      layers: complexLayers,
      events: [
        started('Preflight'),
        completed('Preflight'),
        started('Publish:@kitz/core'),
        started('Publish:@kitz/flo'),
        started('Publish:@kitz/syn'),
        completed('Publish:@kitz/core'),
      ],
    },
  )
  .test()

Test.describe('Renderer > complex DAG > full')
  .on(renderDagFull)
  .snapshots({ arguments: false })
  .casesInput({ layers: complexLayers })
  .test()

// ─── State Management ──────────────────────────────────────────

describe('Renderer state', () => {
  test('getState returns current state', () => {
    const renderer = Flo.Viz.Renderer.create({
      activities: ['A', 'B', 'C'],
      colors: false,
    })

    let state = renderer.getState()
    expect(state.completedCount).toBe(0)
    expect(state.totalCount).toBe(3)
    expect(state.currentActivity).toBeNull()
    expect(Option.getOrNull(MutableHashMap.get(state.activities, 'A'))).toBe('pending')

    renderer.update(started('A'))
    state = renderer.getState()
    expect(state.currentActivity).toBe('A')
    expect(Option.getOrNull(MutableHashMap.get(state.activities, 'A'))).toBe('running')

    renderer.update(completed('A'))
    state = renderer.getState()
    expect(state.completedCount).toBe(1)
    expect(Option.getOrNull(MutableHashMap.get(state.activities, 'A'))).toBe('completed')
  })

  test('workflow events clear current activity', () => {
    const renderer = Flo.Viz.Renderer.create({
      activities: ['A'],
      colors: false,
    })

    renderer.update(started('A'))
    expect(renderer.getState().currentActivity).toBe('A')

    renderer.update(Flo.WorkflowEvent.Completed.make({ timestamp: new Date(), durationMs: 1000 }))
    expect(renderer.getState().currentActivity).toBeNull()
  })
})
