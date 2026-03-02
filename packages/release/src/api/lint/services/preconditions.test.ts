import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { DefaultLayer, EvaluatedPreconditionsService, make } from './preconditions.js'

describe('Preconditions service', () => {
  test('default layer has all false', async () => {
    const result = await Effect.runPromise(
      EvaluatedPreconditionsService.pipe(
        Effect.provide(DefaultLayer),
      ),
    )
    expect(result.hasOpenPR).toBe(false)
    expect(result.hasDiff).toBe(false)
    expect(result.isMonorepo).toBe(false)
    expect(result.hasGitHubAccess).toBe(false)
    expect(result.hasReleasePlan).toBe(false)
  })

  test('make with partial overrides', async () => {
    const result = await Effect.runPromise(
      EvaluatedPreconditionsService.pipe(
        Effect.provide(make({ hasOpenPR: true, isMonorepo: true })),
      ),
    )
    expect(result.hasOpenPR).toBe(true)
    expect(result.hasDiff).toBe(false)
    expect(result.isMonorepo).toBe(true)
    expect(result.hasGitHubAccess).toBe(false)
    expect(result.hasReleasePlan).toBe(false)
  })

  test('make with all overrides', async () => {
    const result = await Effect.runPromise(
      EvaluatedPreconditionsService.pipe(
        Effect.provide(make({
          hasOpenPR: true,
          hasDiff: true,
          isMonorepo: true,
          hasGitHubAccess: true,
          hasReleasePlan: true,
        })),
      ),
    )
    expect(result.hasOpenPR).toBe(true)
    expect(result.hasDiff).toBe(true)
    expect(result.isMonorepo).toBe(true)
    expect(result.hasGitHubAccess).toBe(true)
    expect(result.hasReleasePlan).toBe(true)
  })
})
