import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'bun:test'
import { ResolvedConfig } from '../config.js'
import * as LintConfig from '../lint/models/config.js'
import { ResolvedOperator } from '../operator.js'
import { defaultPublishing } from '../publishing.js'
import { digestPlanBody, PlanBody } from '../release-contract.js'
import { Plan } from './models/plan.js'
import { attachPublishContract, withPublishIntent } from './publish-contract.js'

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
    expect(result.publishIntent?.profile.packDriver).toBe('npm')
    expect(result.publishIntent?.profile.publishInvoker).toBe('npm')
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
        }),
      ),
    )
  })
})
