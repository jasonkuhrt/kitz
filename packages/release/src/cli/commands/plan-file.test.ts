import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  formatIgnoredInvalidPlanMessage,
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'

describe('plan-file helpers', () => {
  test('loads a missing active plan as PlanMissing', async () => {
    const result = await Effect.runPromise(
      loadActivePlan().pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(result._tag).toBe('PlanMissing')
    if (result._tag !== 'PlanMissing') {
      throw new Error('expected missing plan')
    }

    expect(formatMissingPlanMessage(result)).toEqual([
      'Active release plan not found at /repo/.release/plan.json.',
      "Run 'release plan --lifecycle <official|candidate|ephemeral>' first to generate a plan.",
    ])
  })

  test('formats invalid active plans with regeneration and ignore guidance', async () => {
    const result = await Effect.runPromise(
      loadActivePlan().pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({
              '/repo/.release/plan.json': '{"broken":true}',
            }),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(result._tag).toBe('PlanInvalid')
    if (result._tag !== 'PlanInvalid') {
      throw new Error('expected invalid plan')
    }

    const message = formatInvalidPlanMessage(result).join('\n')
    expect(message).toContain('Active release plan at /repo/.release/plan.json is unreadable.')
    expect(message).toContain('stale, malformed, or written by an older @kitz/release schema')
    expect(message).toContain("Run 'release plan --lifecycle <official|candidate|ephemeral>'")
    expect(message).toContain('delete /repo/.release/plan.json')

    const ignored = formatIgnoredInvalidPlanMessage(result).join('\n')
    expect(ignored).toContain('Ignoring the invalid active plan')
  })

  test('formats missing custom plans with an --out regeneration hint', async () => {
    const result = await Effect.runPromise(
      loadPlan({
        path: Fs.Path.fromString('./tmp/release-plan.json'),
        source: 'custom',
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(result._tag).toBe('PlanMissing')
    if (result._tag !== 'PlanMissing') {
      throw new Error('expected missing custom plan')
    }

    const message = formatMissingPlanMessage(result).join('\n')
    expect(message).toContain('/repo/tmp/release-plan.json')
    expect(message).toContain('--out /repo/tmp/release-plan.json')
  })
})
