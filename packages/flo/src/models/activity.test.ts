import { describe, expect, test } from 'vitest'
import * as Activity from './activity.js'

describe('Flo.Activity', () => {
  test('creates lifecycle events and derives their states', () => {
    const started = Activity.Started.make({
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:00.000Z'),
      resumed: false,
    })
    const completed = Activity.Completed.make({
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:01.000Z'),
      resumed: true,
      durationMs: 5,
    })
    const failed = Activity.Failed.make({
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:02.000Z'),
      error: 'boom',
    })

    expect(Activity.State.enums).toEqual({
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      failed: 'failed',
    })
    expect(Activity.Started.is(started)).toBe(true)
    expect(Activity.Completed.is(completed)).toBe(true)
    expect(Activity.Failed.is(failed)).toBe(true)
    expect(Activity.stateFromEvent(started)).toBe(Activity.State.enums.running)
    expect(Activity.stateFromEvent(completed)).toBe(Activity.State.enums.completed)
    expect(Activity.stateFromEvent(failed)).toBe(Activity.State.enums.failed)
  })

  test('exposes schema statics for each lifecycle event', () => {
    const startedInput = {
      _tag: 'ActivityStarted',
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:00.000Z'),
      resumed: false,
    } as const
    const completedInput = {
      _tag: 'ActivityCompleted',
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:01.000Z'),
      resumed: true,
      durationMs: 5,
    } as const
    const failedInput = {
      _tag: 'ActivityFailed',
      activity: 'Build',
      timestamp: new Date('2024-01-01T00:00:02.000Z'),
      error: 'boom',
    } as const

    const started = Activity.Started.decodeSync(startedInput)
    const completed = Activity.Completed.decodeSync(completedInput)
    const failed = Activity.Failed.decodeSync(failedInput)

    expect(Activity.Started.encodeSync(started)).toEqual(startedInput)
    expect(Activity.Completed.encodeSync(completed)).toEqual(completedInput)
    expect(Activity.Failed.encodeSync(failed)).toEqual(failedInput)

    expect(Activity.Started.equivalence(started, Activity.Started.make(startedInput))).toBe(true)
    expect(Activity.Completed.equivalence(completed, Activity.Completed.make(completedInput))).toBe(
      true,
    )
    expect(Activity.Failed.equivalence(failed, Activity.Failed.make(failedInput))).toBe(true)

    expect(Activity.Started.ordered).toBe(false)
    expect(Activity.Completed.ordered).toBe(false)
    expect(Activity.Failed.ordered).toBe(false)

    expect(typeof Activity.Started.decode).toBe('function')
    expect(typeof Activity.Started.encode).toBe('function')
    expect(typeof Activity.Completed.decode).toBe('function')
    expect(typeof Activity.Completed.encode).toBe('function')
    expect(typeof Activity.Failed.decode).toBe('function')
    expect(typeof Activity.Failed.encode).toBe('function')
  })
})
