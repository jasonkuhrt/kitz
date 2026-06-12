import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as fc from 'fast-check'
import { arbBump, arbIso, arbSemver, arbWord, roundtrips } from '../../../test-support.js'
import { makeCascadeCommit, type ReleaseCommit } from '../../analyzer/models/commit.js'
import { Candidate as CandidateVersion } from '../../version/models/candidate.js'
import { Ephemeral as EphemeralVersion } from '../../version/models/ephemeral.js'
import { OfficialFirst } from '../../version/models/official-first.js'
import { OfficialIncrement } from '../../version/models/official-increment.js'
import type { Lifecycle } from '../../version/models/lifecycle.js'
import { Candidate } from './item-candidate.js'
import { Ephemeral } from './item-ephemeral.js'
import { Official } from './item-official.js'
import * as PlannerResource from '../resource.js'
import { isPlanOf, Plan, type PlannedItem } from './plan.js'

const pkg = (name: string, scope: string) => ({
  name: Pkg.Moniker.parse(name),
  scope,
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const commit = (scope: string) => makeCascadeCommit(scope, 'test commit')

describe('Plan', () => {
  test('Plan.empty', () => {
    const plan = Plan.empty
    expect(Plan.is(plan)).toBe(true)
    expect(plan.releases).toHaveLength(0)
    expect(plan.cascades).toHaveLength(0)
    expect(plan.lifecycle).toBe('official')
  })

  test('make with releases', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })
    expect(plan.releases).toHaveLength(1)
    expect(plan.lifecycle).toBe('official')
  })

  test('make with cascades', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [],
      cascades: [
        Official.make({
          package: pkg('@kitz/cli', 'cli'),
          version: OfficialIncrement.make({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.0.1'),
            bump: 'patch',
          }),
          commits: [commit('cli')],
        }),
      ],
    })
    expect(plan.cascades).toHaveLength(1)
  })

  test('lifecycle variants', () => {
    for (const lifecycle of ['official', 'candidate', 'ephemeral'] as const) {
      const plan = Plan.make({
        lifecycle,
        timestamp: '2026-01-01T00:00:00Z',
        releases: [],
        cascades: [],
      })
      expect(plan.lifecycle).toBe(lifecycle)
    }
  })

  test('schema roundtrip with official releases', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialIncrement.make({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.1.0'),
            bump: 'minor',
          }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })

    const encoded = Schema.encodeSync(Plan)(plan)
    const decoded = Schema.decodeSync(Plan)(encoded)
    expect(decoded.releases).toHaveLength(1)
    expect(decoded.lifecycle).toBe('official')
  })

  test('isPlanOf narrows only plans with matching lifecycle-consistent items', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })
    const mismatched = Plan.makeUnchecked({
      lifecycle: 'candidate',
      timestamp: plan.timestamp,
      releases: plan.releases,
      cascades: plan.cascades,
    })

    expect(isPlanOf('official', plan)).toBe(true)
    expect(isPlanOf('candidate', plan)).toBe(false)
    expect(isPlanOf('candidate', mismatched)).toBe(false)
  })

  test('rejects lifecycle-mismatched items at construction time', () => {
    expect(() =>
      Plan.make({
        lifecycle: 'candidate',
        timestamp: '2026-01-01T00:00:00Z',
        releases: [
          Official.make({
            package: pkg('@kitz/core', 'core'),
            version: OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' }),
            commits: [commit('core')],
          }),
        ],
        cascades: [],
      }),
    ).toThrow('Plan lifecycle "candidate" cannot include Official items in releases.')
  })

  test('resource rejects lifecycle-mismatched plans at the I/O boundary', async () => {
    const releaseDir = Fs.Path.AbsDir.fromString('/repo/.release/')
    const invalidPlan = Plan.makeUnchecked({
      lifecycle: 'candidate',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })

    const result = await Effect.runPromise(
      PlannerResource.resource
        .write(invalidPlan, releaseDir)
        .pipe(Effect.provide(Fs.Memory.layer({})), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('ResourceParseError')
      expect(result.failure.message).toContain('Plan lifecycle "candidate" cannot include Official')
    }
  })

  test('resource round-trips release commit dates through JSON storage', async () => {
    const releaseDir = Fs.Path.AbsDir.fromString('/repo/.release/')
    const validPlan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialFirst.make({ version: Semver.fromString('0.1.0'), bump: 'minor' }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })

    const stored = await Effect.runPromise(
      Effect.gen(function* () {
        yield* PlannerResource.resource.write(validPlan, releaseDir)
        return yield* PlannerResource.resource.read(releaseDir)
      }).pipe(Effect.provide(Fs.Memory.layer({}))),
    )

    expect(stored._tag).toBe('Some')
    if (stored._tag === 'None') {
      throw new Error('expected a persisted plan')
    }

    expect(stored.value.releases[0]?.commits[0]?.date).toBeInstanceOf(Date)
  })
})

// ── Properties ───────────────────────────────────────────────────────
//
// `Schema.toArbitrary(Plan)` cannot be used directly: the plan's leaf class
// schemas (`Pkg.Moniker`, `Semver`, `Fs.Path`) derive type-side arbitraries
// that admit values violating their encoded contracts (e.g. a moniker scope
// containing `/`), and the plan's lifecycle invariant requires items to match
// the plan lifecycle. Plans are therefore generated per-lifecycle through the
// same parsers production uses, so every value is valid by construction.

const arbPackage = fc.tuple(arbWord, arbWord).map(([scope, name]) => ({
  scope,
  name: Pkg.Moniker.parse(`@${scope}/${name}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
}))

const arbCommitsFor = (scope: string): fc.Arbitrary<ReleaseCommit[]> =>
  fc
    .array(fc.tuple(fc.string({ maxLength: 30 }), arbIso), { maxLength: 3 })
    .map((pairs) => pairs.map(([description, date]) => makeCascadeCommit(scope, description, date)))

const arbOfficialVersion = fc.oneof(
  fc.tuple(arbSemver, arbBump).map(([version, bump]) => OfficialFirst.make({ version, bump })),
  fc
    .tuple(arbSemver, arbSemver, arbBump)
    .map(([from, to, bump]) => OfficialIncrement.make({ from, to, bump })),
)

const arbOfficialItem = fc
  .tuple(arbPackage, arbOfficialVersion)
  .chain(([pkg, version]) =>
    arbCommitsFor(pkg.scope).map((commits) => Official.make({ package: pkg, version, commits })),
  )

const arbCandidateItem = fc
  .tuple(arbPackage, arbSemver, fc.integer({ min: 1, max: 999 }))
  .chain(([pkg, baseVersion, iteration]) =>
    arbCommitsFor(pkg.scope).map((commits) =>
      Candidate.make({
        package: pkg,
        baseVersion,
        prerelease: CandidateVersion.make({ iteration }),
        commits,
      }),
    ),
  )

const arbSha = fc.stringMatching(/^[a-f0-9]{7}$/).map((hex) => Git.Sha.make(hex))

const arbEphemeralItem = fc
  .tuple(arbPackage, fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 99 }), arbSha)
  .chain(([pkg, prNumber, iteration, sha]) =>
    arbCommitsFor(pkg.scope).map((commits) =>
      Ephemeral.make({
        package: pkg,
        prerelease: EphemeralVersion.make({ prNumber, iteration, sha }),
        commits,
      }),
    ),
  )

const arbPlanOf = <$lifecycle extends Lifecycle>(
  lifecycle: $lifecycle,
  arbItem: fc.Arbitrary<PlannedItem<$lifecycle>>,
): fc.Arbitrary<Plan> =>
  fc
    .tuple(fc.array(arbItem, { maxLength: 3 }), fc.array(arbItem, { maxLength: 2 }), arbIso)
    .map(([releases, cascades, timestamp]) =>
      Plan.make({ lifecycle, timestamp, releases, cascades }),
    )

const arbPlan = fc.oneof(
  arbPlanOf('official', arbOfficialItem),
  arbPlanOf('candidate', arbCandidateItem),
  arbPlanOf('ephemeral', arbEphemeralItem),
)

roundtrips('Plan', Plan, arbPlan)
