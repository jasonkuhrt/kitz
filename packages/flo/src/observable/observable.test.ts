import { Effect, Exit, PubSub, Schema } from 'effect'
import { Workflow as EffectWorkflow, WorkflowEngine } from 'effect/unstable/workflow'
import { describe, expect, test } from 'vitest'
import * as Activity from '../models/activity.js'
import type { LifecycleEvent } from './observable.js'
import { ObservableActivity, WorkflowEvents } from './observable.js'

const makeWorkflowInstance = (name: string) =>
  WorkflowEngine.WorkflowInstance.initial(
    EffectWorkflow.make({
      name,
      payload: Schema.Struct({}),
      success: Schema.Unknown,
      error: Schema.Never,
      idempotencyKey: () => `${name}-id`,
    }),
    `${name}-execution`,
  )

const runObservableWithEvents = <A, E>(
  name: string,
  effect: Effect.Effect<A, E>,
): Effect.Effect<
  { readonly exit: Exit.Exit<A, E>; readonly events: ReadonlyArray<LifecycleEvent> },
  never,
  WorkflowEngine.WorkflowEngine
> =>
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<LifecycleEvent>()
    const subscription = yield* PubSub.subscribe(pubsub)
    const exit = yield* Effect.exit(
      effect.pipe(
        Effect.provideService(WorkflowEvents, pubsub),
        Effect.provideService(WorkflowEngine.WorkflowInstance, makeWorkflowInstance(name)),
      ),
    )
    const events = yield* PubSub.takeAll(subscription)

    return {
      exit,
      events: Array.from(events),
    }
  }).pipe(Effect.scoped)

describe('Flo.ObservableActivity', () => {
  test('runs normally when workflow events are not provided', async () => {
    let runs = 0

    await Effect.runPromise(
      ObservableActivity.create({
        name: 'NoEvents',
        execute: Effect.sync(() => {
          runs++
        }),
      }).pipe(
        Effect.provideService(WorkflowEngine.WorkflowInstance, makeWorkflowInstance('NoEvents')),
        Effect.provide(WorkflowEngine.layerMemory),
      ),
    )

    expect(runs).toBe(1)
  })

  test('publishes started, failed, and completed events across a retry', async () => {
    const RetryableError = Schema.Struct({
      _tag: Schema.Literal('RetryableError'),
      message: Schema.String,
    })

    let runs = 0
    const result = await Effect.runPromise(
      runObservableWithEvents(
        'Retrying',
        ObservableActivity.create({
          name: 'Retrying',
          error: RetryableError,
          execute: Effect.suspend(() => {
            runs++
            return runs === 1
              ? Effect.fail({
                  _tag: 'RetryableError' as const,
                  message: 'try again',
                })
              : Effect.void
          }),
          retry: { times: 1 },
        }),
      ).pipe(Effect.provide(WorkflowEngine.layerMemory)),
    )

    expect(Exit.isSuccess(result.exit)).toBe(true)
    expect(runs).toBe(2)
    expect(result.events.map((event) => event._tag)).toEqual([
      'ActivityStarted',
      'ActivityFailed',
      'ActivityCompleted',
    ])

    const completed = result.events[2]
    expect(completed && Activity.Completed.is(completed)).toBe(true)
    if (completed && Activity.Completed.is(completed)) {
      expect(completed.activity).toBe('Retrying')
      expect(completed.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  test('serializes non-Error failures in failed events', async () => {
    const BoomError = Schema.Struct({
      _tag: Schema.Literal('BoomError'),
      message: Schema.String,
    })

    const result = await Effect.runPromise(
      runObservableWithEvents(
        'Failing',
        ObservableActivity.create({
          name: 'Failing',
          error: BoomError,
          execute: Effect.fail({
            _tag: 'BoomError' as const,
            message: 'bad payload',
          }),
        }),
      ).pipe(Effect.provide(WorkflowEngine.layerMemory)),
    )

    expect(Exit.isFailure(result.exit)).toBe(true)
    expect(result.events.map((event) => event._tag)).toEqual(['ActivityStarted', 'ActivityFailed'])

    const failed = result.events[1]
    expect(failed && Activity.Failed.is(failed)).toBe(true)
    if (failed && Activity.Failed.is(failed)) {
      expect(failed.error).toContain('bad payload')
    }
  })
})
