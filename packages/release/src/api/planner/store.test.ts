import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { makeCascadeCommit } from '../analyzer/models/commit.js'
import { PlanDigest } from '../release-contract.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { Official } from './models/item-official.js'
import { Plan } from './models/plan.js'
import {
  activePlanDisplayPath,
  archive,
  delete_,
  deleteActive,
  read,
  readActive,
  resolveArchiveLocation,
  resolvePlanLocation,
  resolveActivePlanLocation,
  write,
  writeActive,
} from './store.js'

const plan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-01-01T00:00:00Z',
  releases: [
    Official.make({
      package: {
        name: Pkg.Moniker.parse('@kitz/core'),
        scope: 'core',
        path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
      },
      version: OfficialFirst.make({
        version: Semver.fromString('1.0.0'),
        bump: 'major',
      }),
      commits: [makeCascadeCommit('core', 'feature')],
    }),
  ],
  cascades: [],
})

describe('planner store', () => {
  test('resolves the active plan location from cwd', async () => {
    const location = await Effect.runPromise(
      resolveActivePlanLocation.pipe(
        Effect.provide(Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })),
      ),
    )

    expect(Fs.Path.toString(location.dir)).toBe('/repo/.release/')
    expect(Fs.Path.toString(location.file)).toBe('/repo/.release/plan.json')
    expect(activePlanDisplayPath).toBe(Fs.Path.toString(Fs.Path.fromString('./.release/plan.json')))
  })

  test('writes, reads, and deletes the active plan through the shared store', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* writeActive(plan)
        const stored = yield* readActive
        const deleted = yield* deleteActive
        const afterDelete = yield* readActive

        return { stored, deleted, afterDelete }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result.stored)).toBe(true)
    if (Option.isNone(result.stored)) {
      throw new Error('expected the plan store to return the written plan')
    }

    expect(Plan.is(result.stored.value)).toBe(true)
    expect(result.stored.value.lifecycle).toBe(plan.lifecycle)
    expect(result.stored.value.releases).toHaveLength(1)
    expect(result.stored.value.releases[0]?.package.name.moniker).toBe('@kitz/core')
    expect(result.stored.value.releases[0]?.commits[0]?.date.toISOString()).toBe(
      plan.releases[0]?.commits[0]?.date.toISOString(),
    )
    expect(result.deleted).toBe(true)
    expect(Option.isNone(result.afterDelete)).toBe(true)
  })

  test('archives a plan immutably by digest without touching the active pointer', async () => {
    const planDigest = PlanDigest.make({ algorithm: 'sha256', value: 'deadbeefcafe' })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const location = yield* resolveArchiveLocation(planDigest)
        yield* writeActive(plan)
        const archivedFile = yield* archive(plan, planDigest)
        const archived = yield* read(archivedFile)
        const activeAfter = yield* readActive
        // Re-archiving the same digest is idempotent (same digest-addressed path).
        const archivedAgain = yield* archive(plan, planDigest)
        return { location, archivedFile, archived, activeAfter, archivedAgain }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Fs.Path.toString(result.location)).toBe('/repo/.release/plans/deadbeefcafe.json')
    expect(Fs.Path.toString(result.archivedFile)).toBe('/repo/.release/plans/deadbeefcafe.json')
    expect(Fs.Path.toString(result.archivedAgain)).toBe(Fs.Path.toString(result.archivedFile))
    expect(Option.isSome(result.archived)).toBe(true)
    if (Option.isSome(result.archived)) {
      expect(result.archived.value.releases[0]?.package.name.moniker).toBe('@kitz/core')
    }
    // Archiving is additive: the active plan pointer is untouched (apply clears
    // it explicitly afterwards).
    expect(Option.isSome(result.activeAfter)).toBe(true)
  })

  test('resolves custom plan file paths relative to cwd', async () => {
    const location = await Effect.runPromise(
      resolvePlanLocation(Fs.Path.fromString('./tmp/release-plan.json')).pipe(
        Effect.provide(Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })),
      ),
    )

    expect(Fs.Path.toString(location.path)).toBe('/repo/tmp/release-plan.json')
    expect(Fs.Path.toString(location.dir)).toBe('/repo/tmp/')
    expect(Fs.Path.toString(location.file)).toBe('/repo/tmp/release-plan.json')
  })

  test('writes, reads, and deletes a plan at a custom file path without using the active location', async () => {
    const customPath = Fs.Path.fromString('./tmp/release-plan.json')

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* write(plan, customPath)
        const stored = yield* read(customPath)
        const activePlan = yield* readActive
        const deleted = yield* delete_(customPath)
        const afterDelete = yield* read(customPath)

        return { stored, activePlan, deleted, afterDelete }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result.stored)).toBe(true)
    if (Option.isNone(result.stored)) {
      throw new Error('expected the custom plan store to return the written plan')
    }

    expect(result.stored.value.releases[0]?.package.name.moniker).toBe('@kitz/core')
    expect(Option.isNone(result.activePlan)).toBe(true)
    expect(result.deleted).toBe(true)
    expect(Option.isNone(result.afterDelete)).toBe(true)
  })
})
