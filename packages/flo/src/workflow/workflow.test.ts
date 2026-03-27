import { Effect, Exit, Fiber, Schema, Stream } from 'effect'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { describe, expect, test } from 'vitest'
import * as Flo from '../__.js'

const Payload = Schema.Struct({
  value: Schema.Number,
})

describe('Flo.Workflow', () => {
  test('builds graphs, unwraps nested handles, and reuses completed executions', async () => {
    const workflow = Flo.Workflow.make({
      name: 'CoverageWorkflow',
      payload: Payload,
      idempotencyKey: (payload) => `coverage:${payload.value}`,
      layerConcurrency: 1,
      graph: (payload, node) => {
        const prepare = node('Prepare', Effect.succeed(payload.value + 1))
        const publish = node('Publish', Effect.succeed(payload.value * 2), {
          after: prepare,
          retry: { times: 1 },
        })
        const checkpoint = node(
          'Checkpoint',
          Flo.Observable.ObservableActivity.create({
            name: 'InnerCheckpoint',
            execute: Effect.void,
          }).pipe(Effect.as(`done:${payload.value}`)),
          { after: [prepare, publish] },
        )

        return {
          prepare,
          nested: [publish, { checkpoint }],
          literal: 'ok',
        }
      },
    })

    const graph = workflow.toGraph({ value: 2 })
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const executionId = yield* workflow.executionId({ value: 2 })
        const before = yield* workflow.exists({ value: 2 })
        const first = yield* workflow.execute({ value: 2 })
        const after = yield* workflow.exists({ value: 2 })
        const second = yield* workflow.execute({ value: 2 })

        return { executionId, before, first, after, second }
      }).pipe(Effect.provide(WorkflowEngine.layerMemory)),
    )

    expect(workflow.name).toBe('CoverageWorkflow')
    expect(graph.layers).toEqual([['Prepare'], ['Publish'], ['Checkpoint']])
    expect(Array.from(graph.nodes.keys())).toEqual(['Prepare', 'Publish', 'Checkpoint'])
    expect(graph.nodes.get('Publish')?.dependencies).toEqual(['Prepare'])
    expect(graph.nodes.get('Checkpoint')?.dependencies).toEqual(['Prepare', 'Publish'])
    expect(typeof result.executionId).toBe('string')
    expect(result.executionId.length).toBeGreaterThan(0)
    expect(result.before).toBe(false)
    expect(result.first).toEqual({
      prepare: 3,
      nested: [4, { checkpoint: 'done:2' }],
      literal: 'ok',
    })
    expect(result.after).toBe(true)
    expect(result.second).toEqual(result.first)
  })

  test('detects cycles when graph dependencies cannot be resolved', () => {
    const nodeHandleTypeId = Symbol.for('@kitz/flo/NodeHandle')

    const workflow = Flo.Workflow.make({
      name: 'CyclicWorkflow',
      payload: Schema.Struct({}),
      graph: (_payload, node) => {
        const phantomB = {
          [nodeHandleTypeId]: nodeHandleTypeId,
          name: 'B',
        } as any

        const a = node('A', Effect.void, { after: phantomB })
        node('B', Effect.void, { after: a })

        return { a }
      },
    })

    expect(() => workflow.toGraph({})).toThrow('Cycle detected in workflow graph')
  })

  test('emits observable success and failure events', async () => {
    const successWorkflow = Flo.Workflow.make({
      name: 'ObservableWorkflowSuccess',
      payload: Payload,
      graph: (payload, node) => {
        const first = node('First', Effect.succeed(payload.value + 1))
        const second = node('Second', Effect.succeed(payload.value * 2), { after: first })
        return { first, second }
      },
    })

    const success = await Effect.runPromise(
      Effect.gen(function* () {
        const observable = yield* successWorkflow.observable({ value: 1 })
        const fiber = yield* Stream.runCollect(Stream.take(observable.events, 5)).pipe(
          Effect.forkChild,
        )
        const result = yield* observable.execute
        const events = yield* Fiber.join(fiber)

        return { result, events: Array.from(events) }
      }).pipe(Effect.provide(WorkflowEngine.layerMemory)),
    )

    expect(success.result).toEqual({ first: 2, second: 2 })
    expect(success.events.map((event) => event._tag)).toEqual([
      'ActivityStarted',
      'ActivityCompleted',
      'ActivityStarted',
      'ActivityCompleted',
      'WorkflowCompleted',
    ])

    const failureWorkflow = Flo.Workflow.make({
      name: 'ObservableWorkflowFailure',
      payload: Payload,
      error: Schema.String,
      graph: (_payload, node) => {
        const broken = node('Broken', Effect.fail('boom'))
        return { broken }
      },
    })

    const failure = await Effect.runPromise(
      Effect.gen(function* () {
        const observable = yield* failureWorkflow.observable({ value: 1 })
        const fiber = yield* Stream.runCollect(Stream.take(observable.events, 2)).pipe(
          Effect.forkChild,
        )
        const exit = yield* Effect.exit(observable.execute)
        const events = yield* Fiber.join(fiber)

        return { exit, events: Array.from(events) }
      }).pipe(Effect.provide(WorkflowEngine.layerMemory)),
    )

    expect(Exit.isFailure(failure.exit)).toBe(true)
    expect(failure.events.map((event) => event._tag)).toEqual(['ActivityStarted', 'WorkflowFailed'])

    const failed = failure.events[1]
    expect(failed && Flo.WorkflowEvent.Failed.is(failed)).toBe(true)
    if (failed && Flo.WorkflowEvent.Failed.is(failed)) {
      expect(failed.error).toContain('boom')
    }
  })
})
