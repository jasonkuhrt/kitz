import { describe, expect, test } from 'bun:test'
import { Env } from '@kitz/env'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Fs } from '@kitz/fs'
import { Semver } from '@kitz/semver'
import { Effect, FileSystem, Layer } from 'effect'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Official } from './api/planner/models/item-official.js'
import { Plan } from './api/planner/models/plan.js'
import { OfficialFirst } from './api/version/models/official-first.js'
import { makeCascadeCommit } from './api/analyzer/models/commit.js'
import {
  apply,
  digestPlan,
  inspectLegitimacy,
  makeProofArtifact,
  prove,
  reconcile,
  rehearse,
  status,
  validateProof,
} from './promise-api.js'
import { publishIntentFromSemantics } from './api/release-contract.js'

const pkg = {
  name: Pkg.Moniker.parse('@kitz/core'),
  scope: 'core',
  path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
}

describe('release promise api', () => {
  test('exposes decoded DTO helpers without hiding file-format semantics', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-05-14T00:00:00.000Z',
      releases: [
        Official.make({
          package: pkg,
          version: OfficialFirst.make({
            version: Semver.fromString('1.0.0'),
            bump: 'major',
          }),
          commits: [makeCascadeCommit('core', 'feature')],
        }),
      ],
      cascades: [],
      publishIntent: publishIntentFromSemantics({
        semantics: {
          lifecycle: 'official',
          channel: { mode: 'manual' },
          distTag: 'latest',
          prerelease: false,
          forcePushTag: false,
          githubReleaseStyle: 'versioned',
        },
        trunk: 'main',
      }),
    })

    const proof = makeProofArtifact(plan, '2026-05-14T00:00:00.000Z', {
      packageAccess: { '@kitz/core': 'public' },
    })

    expect(digestPlan(plan).algorithm).toBe('sha256')
    expect(validateProof(proof).map((issue) => issue.code)).toContain('release.proof.unprovable')
    expect(inspectLegitimacy({ onRegistry: true, inJournal: true })).toBe(
      'registry-matches-journal',
    )
  })

  test('runs Effect-backed operations through supplied dependencies', async () => {
    const emptyPlan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-05-14T00:00:00.000Z',
      releases: [],
      cascades: [],
    })
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      Fs.Memory.layer({}),
      WorkflowEngine.layerMemory,
      Layer.succeed(NpmRegistry.NpmCli, {
        whoami: () => Effect.die('unexpected whoami'),
        pack: () => Effect.die('unexpected pack'),
        publish: () => Effect.die('unexpected publish'),
        observeVersion: () => Effect.die('unexpected observe'),
        hasVersion: () => Effect.succeed(true),
        listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
        listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
        getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
      }),
    )

    expect(await prove(emptyPlan, { layer })).toMatchObject({ schemaVersion: 1 })
    expect(await rehearse(emptyPlan, { layer })).toEqual([])
    expect(await status(emptyPlan, {}, { layer })).toMatchObject({ state: 'not-started' })
    expect(await apply(emptyPlan, { dryRun: true }, { layer })).toMatchObject({
      releasedPackages: [],
    })
    expect(await reconcile(emptyPlan, { layer })).toMatchObject({
      classification: 'clean',
    })
  })

  test('threads rehearsal options through the promise adapter', async () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-05-14T00:00:00.000Z',
      releases: [
        Official.make({
          package: pkg,
          version: OfficialFirst.make({
            version: Semver.fromString('1.0.0'),
            bump: 'major',
          }),
          commits: [makeCascadeCommit('core', 'feature')],
        }),
      ],
      cascades: [],
      publishIntent: publishIntentFromSemantics({
        semantics: {
          lifecycle: 'official',
          channel: { mode: 'manual' },
          distTag: 'latest',
          prerelease: false,
          forcePushTag: false,
          githubReleaseStyle: 'versioned',
        },
        trunk: 'main',
      }),
    })
    const publishCalls: Array<{ readonly dryRun: boolean | undefined }> = []
    const fsLayer = Fs.Memory.layer({
      '/repo/packages/core/package.json': JSON.stringify({
        name: '@kitz/core',
        version: '0.0.0',
      }),
    })
    const npmLayer = Layer.effect(
      NpmRegistry.NpmCli,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        return {
          whoami: () => Effect.die('unexpected whoami'),
          pack: (options) =>
            Effect.gen(function* () {
              const tarball = Fs.Path.join(
                options.packDestination,
                Fs.Path.RelFile.fromString('./kitz-core-1.0.0.tgz'),
              )
              yield* fs.writeFileString(Fs.Path.toString(tarball), 'packed').pipe(Effect.orDie)

              return {
                tarball,
                filename: 'kitz-core-1.0.0.tgz',
                files: [],
              }
            }),
          publish: (options) =>
            Effect.sync(() => {
              publishCalls.push({ dryRun: options.dryRun })
            }),
          observeVersion: () => Effect.die('unexpected observe'),
          hasVersion: () => Effect.succeed(false),
          listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
          listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
          getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
        }
      }),
    ).pipe(Layer.provide(fsLayer))
    const layer = Layer.mergeAll(
      Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
      fsLayer,
      npmLayer,
    )

    expect(await rehearse(plan, { publishDryRun: true }, { layer })).toHaveLength(1)
    expect(publishCalls).toEqual([{ dryRun: true }])
  })
})
