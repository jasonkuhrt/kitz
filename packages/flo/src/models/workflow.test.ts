import { describe, expect, test } from 'vitest'
import * as Workflow from './workflow.js'

describe('Flo.WorkflowEvent', () => {
  test('creates workflow lifecycle events', () => {
    const completed = Workflow.Completed.make({
      timestamp: new Date('2024-01-01T00:00:01.000Z'),
      durationMs: 5,
    })
    const failed = Workflow.Failed.make({
      timestamp: new Date('2024-01-01T00:00:02.000Z'),
      error: 'boom',
    })

    expect(Workflow.Completed.is(completed)).toBe(true)
    expect(Workflow.Failed.is(failed)).toBe(true)
  })

  test('exposes schema statics for workflow lifecycle events', () => {
    const completedInput = {
      _tag: 'WorkflowCompleted',
      timestamp: new Date('2024-01-01T00:00:01.000Z'),
      durationMs: 5,
    } as const
    const failedInput = {
      _tag: 'WorkflowFailed',
      timestamp: new Date('2024-01-01T00:00:02.000Z'),
      error: 'boom',
    } as const

    const completed = Workflow.Completed.decodeSync(completedInput)
    const failed = Workflow.Failed.decodeSync(failedInput)

    expect(Workflow.Completed.encodeSync(completed)).toEqual(completedInput)
    expect(Workflow.Failed.encodeSync(failed)).toEqual(failedInput)

    expect(Workflow.Completed.equivalence(completed, Workflow.Completed.make(completedInput))).toBe(
      true,
    )
    expect(Workflow.Failed.equivalence(failed, Workflow.Failed.make(failedInput))).toBe(true)

    expect(Workflow.Completed.ordered).toBe(false)
    expect(Workflow.Failed.ordered).toBe(false)

    expect(typeof Workflow.Completed.decode).toBe('function')
    expect(typeof Workflow.Completed.encode).toBe('function')
    expect(typeof Workflow.Failed.decode).toBe('function')
    expect(typeof Workflow.Failed.encode).toBe('function')
  })
})
