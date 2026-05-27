import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'bun:test'
import { ResolvedConfig } from '../config.js'
import { makeCascadeCommit } from '../analyzer/models/commit.js'
import * as LintConfig from '../lint/models/config.js'
import { ResolvedOperator } from '../operator.js'
import { sha256Text } from '../digest.js'
import { defaultPublishing } from '../publishing.js'
import { digestPlanBody, PlanBody, PlanSourceSnapshot } from '../release-contract.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { Official } from './models/item-official.js'
import { Plan } from './models/plan.js'
import {
  attachPublishContract,
  validateSourceSnapshot,
  withPublishIntent,
} from './publish-contract.js'

const resolvedConfig = ResolvedConfig.make({
  trunk: 'main',
  npmTag: 'latest',
  candidateTag: 'next',
  packages: {},
  publishing: defaultPublishing(),
  operator: ResolvedOperator.make({
    manager: Pkg.Manager.DetectedPackageManager.make({
      name: 'pnpm',
      source: 'manifest',
    }),
    releaseCommand: 'pnpm release',
    prepareCommands: [],
  }),
  resolvedConventionalCommitTypes: {},
  lint: LintConfig.resolveConfig({}),
})

const plan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-05-13T00:00:00.000Z',
  releases: [],
  cascades: [],
})

const layer = Layer.mergeAll(
  Fs.Memory.layer({
    '/repo/package.json': JSON.stringify({
      name: 'fixture',
      packageManager: 'pnpm@11.0.0',
    }),
    '/repo/pnpm-lock.yaml': 'lockfile-content',
  }),
  Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
  Git.Memory.make({
    headSha: Git.Sha.make('abc1234'),
  }),
)

describe('planner publish contract', () => {
  test('withPublishIntent is the public alias for attaching the frozen publish contract', () => {
    expect(withPublishIntent).toBe(attachPublishContract)
  })

  test('attaches publish intent, source snapshot, proof policy, and plan digest', async () => {
    const result = await Effect.runPromise(
      withPublishIntent({
        plan,
        config: resolvedConfig,
        registry: 'https://registry.example.test/',
        signingProfileId: 'developer-key',
      }).pipe(Effect.provide(layer)),
    )

    expect(result.schemaVersion).toBe(2)
    expect(result.signingProfileId).toBe('developer-key')
    expect(result.publishIntent?.distTag).toBe('latest')
    expect(result.publishIntent?.registry.url).toBe('https://registry.example.test/')
    expect(result.publishIntent?.profile.packDriver).toBe('pnpm')
    expect(result.publishIntent?.profile.publishInvoker).toBe('pnpm')
    expect(result.source?.headSha).toBe('abc1234')
    expect(result.source?.packageManager).toEqual({
      name: 'pnpm',
      version: '11.0.0',
      binary: 'pnpm',
      subcommands: {
        pack: true,
        publish: true,
      },
    })
    expect(result.source?.lockfiles.map((entry) => Fs.Path.toString(entry.path))).toEqual([
      './pnpm-lock.yaml',
    ])

    if (
      result.source === undefined ||
      result.publishIntent === undefined ||
      result.proofPolicy === undefined
    ) {
      throw new Error('expected complete plan contract')
    }

    expect(result.planDigest).toEqual(
      digestPlanBody(
        PlanBody.make({
          schemaVersion: 2,
          signingProfileId: 'developer-key',
          source: result.source,
          publishIntent: result.publishIntent,
          proofPolicy: result.proofPolicy,
          releases: [],
        }),
      ),
    )
  })

  test('plan digest changes when the planned release subject changes', async () => {
    const result = await Effect.runPromise(
      withPublishIntent({
        plan,
        config: resolvedConfig,
      }).pipe(Effect.provide(layer)),
    )

    if (
      result.source === undefined ||
      result.publishIntent === undefined ||
      result.proofPolicy === undefined
    ) {
      throw new Error('expected complete plan contract')
    }

    const body = (version: string) =>
      PlanBody.make({
        schemaVersion: 2,
        signingProfileId: result.signingProfileId ?? 'local-developer',
        source: result.source!,
        publishIntent: result.publishIntent!,
        proofPolicy: result.proofPolicy!,
        releases: [
          {
            packageName: Pkg.Moniker.parse('@kitz/core'),
            nextVersion: Semver.fromString(version),
          },
        ],
      })

    expect(digestPlanBody(body('1.0.0')).value).not.toBe(digestPlanBody(body('1.0.1')).value)
  })

  test('plan digest includes the actual release subjects from the plan', async () => {
    const releasePlan = Plan.make({
      lifecycle: plan.lifecycle,
      timestamp: plan.timestamp,
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
    const result = await Effect.runPromise(
      withPublishIntent({
        plan: releasePlan,
        config: resolvedConfig,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.planDigest).toBeDefined()
    expect(result.releases.map((release) => release.package.name.moniker)).toEqual(['@kitz/core'])
  })

  test('source snapshot uses the resolved package-manager detection when manifest version is absent', async () => {
    const result = await Effect.runPromise(
      withPublishIntent({
        plan,
        config: resolvedConfig,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({
              '/repo/package.json': JSON.stringify({ name: 'fixture' }),
              '/repo/pnpm-lock.yaml': 'lockfile-content',
            }),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
            Git.Memory.make({ headSha: Git.Sha.make('abc1234') }),
          ),
        ),
      ),
    )

    expect(result.publishIntent?.profile.packDriver).toBe('pnpm')
    expect(result.source?.packageManager).toEqual({
      name: 'pnpm',
      version: 'unknown',
      binary: 'pnpm',
      subcommands: {
        pack: true,
        publish: true,
      },
    })
  })

  test('source snapshot validation catches missing, changed, and newly added lockfiles', async () => {
    const source = PlanSourceSnapshot.make({
      headSha: 'abc1234',
      trunk: 'main',
      releaseConfigDigest: sha256Text('config'),
      releaseConfigDigestSource: 'canonical-effective-config',
      lockfiles: [
        {
          path: Fs.Path.RelFile.fromString('./pnpm-lock.yaml'),
          digest: sha256Text('old-lock'),
        },
        {
          path: Fs.Path.RelFile.fromString('./package-lock.json'),
          digest: sha256Text('missing-lock'),
        },
      ],
      packageManager: {
        name: 'pnpm',
        version: '11.0.0',
        binary: 'pnpm',
        subcommands: { pack: true, publish: true },
      },
      toolVersions: { pnpm: '11.0.0' },
    })

    const issues = await Effect.runPromise(
      validateSourceSnapshot(source, Fs.Path.AbsDir.fromString('/repo/')).pipe(
        Effect.provide(
          Fs.Memory.layer({
            '/repo/pnpm-lock.yaml': 'new-lock',
            '/repo/bun.lock': 'added-lock',
          }),
        ),
      ),
    )

    expect(issues.map((issue) => issue.code)).toEqual([
      'release.source.lockfile-drift',
      'release.source.lockfile-missing',
      'release.source.lockfile-added',
    ])
  })
})
