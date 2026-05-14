import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Effect, Layer, Option } from 'effect'
import { Env } from '@kitz/env'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { OfficialFirst } from './version/models/official-first.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'
import { makeProofArtifact, prove, readForPlan } from './proof.js'
import { sha256Text } from './digest.js'
import {
  PlanDigest,
  PublishIntent,
  PublishProfile,
  publishIntentFromSemantics,
} from './release-contract.js'

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

const publishIntent = publishIntentFromSemantics({
  semantics: {
    lifecycle: 'official',
    channel: { mode: 'manual' },
    distTag: 'latest',
    prerelease: false,
    forcePushTag: false,
    githubReleaseStyle: 'versioned',
  },
  trunk: 'main',
})

const contractedDigest = PlanDigest.make(sha256Text('contracted'))

const contractedPlan = Plan.make({
  lifecycle: plan.lifecycle,
  timestamp: plan.timestamp,
  releases: plan.releases,
  cascades: plan.cascades,
  planDigest: contractedDigest,
  publishIntent,
})

describe('proof artifact', () => {
  test('uncontracted plans produce blocking proof records', () => {
    const proof = makeProofArtifact(plan)

    expect(proof.records.map((record) => record.status)).toContain('unprovable')
    expect(proof.records.some((record) => record.dependsOn.includes('plan.digest'))).toBe(true)
  })

  test('writes and reads plan-bound proof files', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const written = yield* prove(plan)
        const read = yield* readForPlan(plan)
        return { written, read }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result.read)).toBe(true)
    expect(result.written.planDigest.value).toBe(
      Option.isSome(result.read) ? result.read.value.planDigest.value : '',
    )
  })

  test('records selected provider capability proofs from the frozen publish intent', () => {
    const proof = makeProofArtifact(contractedPlan, '2026-05-13T00:00:00.000Z')
    const ids = proof.records.map((record) => record.id)

    expect(ids).toContain('capability.pack.tarball')
    expect(ids).toContain('capability.publish.tarball')
    expect(ids).toContain('capability.publish.ignore-scripts')
    expect(proof.records.find((record) => record.id === 'capability.publish.tarball')?.status).toBe(
      'proven',
    )
  })

  test('does not require Bun publish ignore-scripts when publishing a prebuilt tarball', () => {
    const bunIntent = PublishIntent.make({
      ...publishIntent,
      profile: PublishProfile.make({
        ...publishIntent.profile,
        id: 'bun-tarball',
        packDriver: 'bun',
        publishInvoker: 'bun',
      }),
    })
    const proof = makeProofArtifact(
      Plan.make({
        lifecycle: contractedPlan.lifecycle,
        timestamp: contractedPlan.timestamp,
        releases: contractedPlan.releases,
        cascades: contractedPlan.cascades,
        planDigest: contractedDigest,
        publishIntent: bunIntent,
      }),
      '2026-05-13T00:00:00.000Z',
    )

    expect(proof.records.map((record) => record.id)).not.toContain(
      'capability.publish.ignore-scripts',
    )
    expect(proof.records.find((record) => record.id === 'capability.publish.tarball')?.status).toBe(
      'proven',
    )
  })
})
