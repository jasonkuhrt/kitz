import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Plan } from './models/plan.js'
import { PLAN_DIR, PLAN_FILE, resolvePlanDir, resolvePlanFile, resource } from './resource.js'

const planDir = Fs.Path.AbsDir.fromString('/repo/')
const planFile = Fs.Path.AbsFile.fromString('/repo/plan.json')
const memoryLayer = Fs.Memory.layer({})

const basePlan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-03-26T00:00:00.000Z',
  releases: [],
  cascades: [],
})

describe('planner resource helpers', () => {
  test('resolves plan paths for directories and files', () => {
    expect(Fs.Path.toString(PLAN_DIR)).toBe('./.release/')
    expect(Fs.Path.toString(PLAN_FILE)).toBe('./.release/plan.json')
    expect(Fs.Path.toString(resolvePlanFile(planDir))).toBe('/repo/plan.json')
    expect(Fs.Path.toString(resolvePlanFile(planFile))).toBe('/repo/plan.json')
    expect(Fs.Path.toString(resolvePlanDir(planDir))).toBe('/repo/')
    expect(Fs.Path.toString(resolvePlanDir(planFile))).toBe('/repo/')
  })

  test('reads missing plans as none or empty', async () => {
    const [optionalPlan, emptyPlan] = await Effect.runPromise(
      Effect.all([resource.read(planDir), resource.readOrEmpty(planDir)]).pipe(
        Effect.provide(memoryLayer),
      ),
    )

    expect(Option.isNone(optionalPlan)).toBe(true)
    expect(emptyPlan).toEqual(Plan.empty)
  })

  test('writes, reads, updates, and deletes plans', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* resource.write(basePlan, planDir)
        const required = yield* resource.readRequired(planDir)
        const updated = yield* resource.update(planFile, (current) =>
          Plan.make({
            lifecycle: current.lifecycle,
            timestamp: '2026-03-27T00:00:00.000Z',
            releases: current.releases,
            cascades: current.cascades,
          }),
        )
        yield* resource.delete(planDir)
        const afterDelete = yield* resource.read(planDir)
        return { required, updated, afterDelete }
      }).pipe(Effect.provide(memoryLayer)),
    )

    expect(result.required).toEqual(basePlan)
    expect(result.updated.timestamp).toBe('2026-03-27T00:00:00.000Z')
    expect(Option.isNone(result.afterDelete)).toBe(true)
  })

  test('rejects lifecycle-inconsistent plans before persisting them', async () => {
    const invalidPlan = {
      ...basePlan,
      releases: [{ _tag: 'Candidate' }],
    } as any

    const result = await Effect.runPromise(
      resource.write(invalidPlan, planDir).pipe(Effect.provide(memoryLayer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag !== 'Failure') {
      throw new Error('expected invalid plan write to fail')
    }

    expect(result.failure).toBeInstanceOf(Resource.ParseError)
    if (result.failure._tag === 'ResourceParseError') {
      expect(Fs.Path.toString(result.failure.context.path)).toBe('/repo/plan.json')
      expect(result.failure.context.detail).toContain('cannot include Candidate')
    }
  })
})
