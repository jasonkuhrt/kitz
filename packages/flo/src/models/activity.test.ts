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
})
