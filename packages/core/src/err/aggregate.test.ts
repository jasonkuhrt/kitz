import { Test } from '#kitz/test'
import { Schema as S } from 'effect'
import { expect } from 'vitest'
import { ContextualAggregateError, partitionAndAggregateErrors } from './aggregate.js'
import { TaggedContextualError } from './contextual.js'

// Test error using new schema-based API
const TestError = TaggedContextualError(
  'TestError',
  ['test'],
  {
    context: S.Struct({ key: S.String }),
    message: (ctx) => `Test error: ${ctx.key}`,
  },
)

Test.describe('ContextualAggregateError > creation')
  .inputType<{
    errors: Error[]
    message?: string
    context?: Record<string, unknown>
  }>()
  .outputType<{
    tag: string
    errorsLength: number
    causeIsDefined: boolean
    hasContext: boolean
  }>()
  .cases(
    [
      { errors: [new Error('First'), new Error('Second')] },
      { tag: 'ContextualAggregateError', errorsLength: 2, causeIsDefined: true, hasContext: false },
    ],
    [
      { errors: [new Error('fail')], context: { operation: 'validation' } },
      { tag: 'ContextualAggregateError', errorsLength: 1, causeIsDefined: true, hasContext: true },
    ],
  )
  .test(({ input, output }) => {
    const aggregate = new ContextualAggregateError(input)

    expect(aggregate._tag).toBe(output.tag)
    expect(aggregate.errors).toHaveLength(output.errorsLength)
    expect(aggregate.cause !== undefined).toBe(output.causeIsDefined)
    expect(aggregate.context !== undefined).toBe(output.hasContext)

    if (output.hasContext) {
      expect(aggregate.context).toEqual(input.context)
    }
  })

Test.describe('partitionAndAggregateErrors > partitioning')
  .inputType<{ results: unknown[]; message?: string }>()
  .outputType<{ values: unknown[]; hasError: boolean; errorCount?: number }>()
  .cases(
    // Mixed values and errors
    [
      { results: [1, new Error('fail'), 2, new Error('fail2'), 3] },
      { values: [1, 2, 3], hasError: true, errorCount: 2 },
    ],
    // All values, no errors
    [
      { results: [1, 2, 3] },
      { values: [1, 2, 3], hasError: false },
    ],
    // All errors
    [
      { results: [new Error('a'), new Error('b')] },
      { values: [], hasError: true, errorCount: 2 },
    ],
    // With TaggedContextualError
    [
      { results: [1, new TestError({ context: { key: 'value' } }), 2] },
      { values: [1, 2], hasError: true, errorCount: 1 },
    ],
  )
  .test(({ input, output }) => {
    const [values, error] = partitionAndAggregateErrors(input.results, input.message)

    expect(values).toEqual(output.values)

    if (output.hasError) {
      expect(error).toBeInstanceOf(ContextualAggregateError)
      expect(error!.errors).toHaveLength(output.errorCount!)

      if (input.message) {
        expect(error!.message).toBe(input.message)
      }
    } else {
      expect(error).toBeNull()
    }
  })
