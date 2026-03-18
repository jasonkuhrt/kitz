import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { makeCascadeCommit } from '../analyzer/models/commit.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { Official } from './models/item-official.js'
import { Plan } from './models/plan.js'
import {
  activePlanDisplayPath,
  deleteActive,
  readActive,
  resolveActivePlanLocation,
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
})
