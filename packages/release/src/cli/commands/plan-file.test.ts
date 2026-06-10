import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, FileSystem, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  formatIgnoredInvalidPlanMessage,
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  formatPlanCommand,
  formatUnsupportedExecutionPlanMessage,
  hasExecutablePlanContract,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'
import * as Api from '../../api/__.js'

const cwd = Fs.Path.AbsDir.fromString('/repo/')
const run = <A>(
  effect: Effect.Effect<A, never, Env.Env | FileSystem.FileSystem>,
  files: Record<string, string> = {},
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer(files), Env.Test({ cwd })))),
  )

describe('plan-file helpers', () => {
  test('formats plan states and follow-up commands', async () => {
    const missing = await run(loadActivePlan())
    if (missing._tag !== 'PlanMissing') throw new Error('expected missing plan')
    expect(formatMissingPlanMessage(missing)).toEqual([
      'Active release plan not found at /repo/.release/plan.json.',
      "Run 'release plan --lifecycle <official|candidate|ephemeral>' first to generate a plan.",
    ])

    const invalid = await run(loadActivePlan(), { '/repo/.release/plan.json': '{"broken":true}' })
    if (invalid._tag !== 'PlanInvalid') throw new Error('expected invalid plan')
    expect(formatInvalidPlanMessage(invalid).join('\n')).toContain(
      'stale, malformed, or written by an older @kitz/release schema',
    )
    expect(formatIgnoredInvalidPlanMessage(invalid).join('\n')).toContain(
      'Ignoring the invalid active plan',
    )

    const customMissing = await run(
      loadPlan({ path: Fs.Path.fromString('./tmp/release-plan.json'), source: 'custom' }),
    )
    if (customMissing._tag !== 'PlanMissing') throw new Error('expected missing custom plan')
    expect(formatMissingPlanMessage(customMissing).join('\n')).toContain(
      '--out /repo/tmp/release-plan.json',
    )

    const plan = Api.Planner.Plan.empty
    expect(hasExecutablePlanContract(plan)).toBe(false)
    expect(formatUnsupportedExecutionPlanMessage(plan)).toEqual([
      'This release plan is missing the frozen v2 execution contract.',
      'Missing field(s): planDigest, publishIntent.',
      'Run `release plan --lifecycle <official|candidate|ephemeral>` again with the current @kitz/release before executing, resuming, graphing, or checking durable status.',
    ])
    expect(
      formatUnsupportedExecutionPlanMessage(
        Api.Planner.Plan.make({
          lifecycle: 'official',
          timestamp: '',
          releases: [],
          cascades: [],
          planDigest: Api.ReleaseContract.PlanDigest.make({
            algorithm: 'sha256',
            value: 'a'.repeat(64),
          }),
        }),
      )[1],
    ).toBe('Missing field(s): publishIntent.')

    const custom = Option.some('./tmp/release plan.json')
    expect(formatPlanCommand('release apply', Option.none())).toBe('release apply')
    expect(formatPlanCommand('release apply', custom)).toBe(
      "release apply --from './tmp/release plan.json'",
    )
    expect(formatPlanCommand('release resume', custom)).toBe(
      "release resume --from './tmp/release plan.json'",
    )
  })
})
