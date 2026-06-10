import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, FileSystem, Layer, Option, Ref } from 'effect'
import { describe, expect, test } from 'bun:test'
import { makeCascadeCommit } from './analyzer/models/commit.js'
import { sha256Bytes, sha256Text } from './digest.js'
import { preparePackageArtifact, PublishError } from './executor/publish.js'
import {
  makeManifestFromPrepared,
  makeManifestFromPlan,
  packEnvironmentForPlan,
  readManifest,
  rehearse,
  validateEnginePolicyForPlan,
  validateScriptPolicyForPlan,
  validateManifestForPlan,
  validateManifestFilesForPlan,
  writeManifest,
} from './artifact.js'
import {
  decodeJsonRecordSync,
  makeHarness,
  makePackageJson,
  planOfficial,
  tag,
} from './executor/test-support.js'
import { OfficialFirst } from './version/models/official-first.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'
import {
  ArtifactPolicy,
  EnginePolicy,
  ArtifactManifest,
  PlanDigest,
  PlanSourceSnapshot,
  PublishIntent,
  ScriptPolicy,
  publishIntentFromSemantics,
} from './release-contract.js'
import { FileSystemLayer } from '../platform.js'

const pkg = {
  name: Pkg.Moniker.parse('@kitz/core'),
  scope: 'core',
  path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
}
const corePackageJsonPath = '/repo/packages/core/package.json'
const coreManifest = (options?: Parameters<typeof makePackageJson>[2]) =>
  makePackageJson('@kitz/core', '1.0.0', options)
const coreDisk = (content = coreManifest()): Fs.Memory.DiskLayout => ({
  [corePackageJsonPath]: content,
})

const tarball = Fs.Path.AbsFile.fromString('/repo/.release/artifacts/kitz-core-1.0.0.tgz')
const tarballBytes = new Uint8Array([1, 2, 3, 4])

const plan = Plan.make({
  lifecycle: 'official',
  timestamp: '2026-05-13T00:00:00.000Z',
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
})

const contractedPlan = Plan.make({
  lifecycle: plan.lifecycle,
  timestamp: plan.timestamp,
  releases: plan.releases,
  cascades: plan.cascades,
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

const sourceSnapshot = PlanSourceSnapshot.make({
  headSha: 'abc1234',
  trunk: 'main',
  releaseConfigDigest: sha256Text('config'),
  releaseConfigDigestSource: 'canonical-effective-config',
  lockfiles: [],
  packageManager: {
    name: 'bun',
    version: '1.3.6',
    binary: 'bun',
    subcommands: { pack: true, publish: true },
  },
  toolVersions: { node: '22.14.0', bun: '1.3.6' },
})

const updatePublishIntent = (intent: PublishIntent, overrides: Partial<PublishIntent>) =>
  PublishIntent.make(Object.assign({}, intent, overrides))

const updateArtifactPolicy = (policy: ArtifactPolicy, overrides: Partial<ArtifactPolicy>) =>
  ArtifactPolicy.make(Object.assign({}, policy, overrides))

const updateScriptPolicy = (policy: ScriptPolicy, overrides: Partial<ScriptPolicy>) =>
  ScriptPolicy.make(Object.assign({}, policy, overrides))

const updateArtifactManifest = (manifest: ArtifactManifest, overrides: Partial<ArtifactManifest>) =>
  ArtifactManifest.make(Object.assign({}, manifest, overrides))

const makeContractedPlan = ({
  source,
  publishIntent = contractedPlan.publishIntent!,
}: {
  readonly source?: PlanSourceSnapshot
  readonly publishIntent?: PublishIntent
} = {}) =>
  Plan.make({
    lifecycle: contractedPlan.lifecycle,
    timestamp: contractedPlan.timestamp,
    releases: contractedPlan.releases,
    cascades: contractedPlan.cascades,
    ...(source === undefined ? {} : { source }),
    publishIntent,
  })

const updateContractedArtifactPolicy = (overrides: Partial<ArtifactPolicy>): PublishIntent =>
  updatePublishIntent(contractedPlan.publishIntent!, {
    artifacts: updateArtifactPolicy(contractedPlan.publishIntent!.artifacts, overrides),
  })

const updateContractedScriptPolicy = (overrides: Partial<ScriptPolicy>): PublishIntent =>
  updateContractedArtifactPolicy({
    scriptPolicy: updateScriptPolicy(
      contractedPlan.publishIntent!.artifacts.scriptPolicy,
      overrides,
    ),
  })

const updateContractedEnginePolicy = (
  overrides: Parameters<typeof EnginePolicy.make>[0],
): PublishIntent =>
  updateContractedArtifactPolicy({
    enginePolicy: EnginePolicy.make(overrides),
  })

const issueCodes = (issues: readonly { readonly code: string }[]) =>
  issues.map((issue) => issue.code)

const engineIssueCodes = (releasePlan: Plan, diskLayout: Fs.Memory.DiskLayout) =>
  Effect.runPromise(
    validateEnginePolicyForPlan(releasePlan).pipe(
      Effect.provide(Fs.Memory.layer(diskLayout)),
      Effect.map(issueCodes),
    ),
  )

const scriptIssueCodes = (releasePlan: Plan, packageJson: string) =>
  Effect.runPromise(
    validateScriptPolicyForPlan(releasePlan).pipe(
      Effect.provide(Fs.Memory.layer(coreDisk(packageJson))),
      Effect.map(issueCodes),
    ),
  )

const allowlistedPrepackPlan = (network: ScriptPolicy['network']) => {
  const command = 'echo preparing'
  const packageJson = coreManifest({ scripts: { prepack: command } })

  return {
    packageJson,
    plan: makeContractedPlan({
      publishIntent: updateContractedScriptPolicy({
        default: 'allow-listed',
        network,
        allowlist: [
          {
            packageName: Pkg.Moniker.parse('@kitz/core'),
            script: 'prepack',
            commandSha256: sha256Text(command),
            packageSourceDigest: sha256Text(packageJson),
          },
        ],
      }),
    }),
  }
}

const artifact = {
  package: pkg,
  nextVersion: Semver.fromString('1.0.0'),
  tarball,
  packMetadata: {
    filename: 'kitz-core-1.0.0.tgz',
    tarball,
    files: [
      { path: 'package.json', size: 42 },
      { path: 'dist/index.js', size: 420 },
    ],
    size: tarballBytes.length,
    shasum: 'npm-sha1',
    integrity: 'sha512-npm',
  },
}

const coreGit = {
  tags: [tag(pkg.name, '1.0.0')],
  commits: [Git.Memory.commit('feat(core): new API')],
  isClean: true,
}

const coreDiskLayout = coreDisk()

const makeCoreHarness = (params?: {
  readonly diskLayout?: Fs.Memory.DiskLayout
  readonly envVars?: Record<string, string | undefined>
  readonly failPublishPackages?: readonly string[]
}) =>
  makeHarness({
    git: coreGit,
    diskLayout: params?.diskLayout ?? coreDiskLayout,
    ...(params?.envVars !== undefined ? { envVars: params.envVars } : {}),
    ...(params?.failPublishPackages !== undefined
      ? { failPublishPackages: params.failPublishPackages }
      : {}),
  })

const rehearseCorePackage = ({
  envVars,
  publishIntent,
  rehearseOptions,
}: {
  readonly envVars?: Record<string, string | undefined>
  readonly publishIntent?: PublishIntent
  readonly rehearseOptions?: Parameters<typeof rehearse>[1]
} = {}) =>
  Effect.gen(function* () {
    const harness = yield* makeCoreHarness({ ...(envVars !== undefined ? { envVars } : {}) })
    const releasePlan = yield* planOfficial([pkg]).pipe(Effect.provide(harness.planLayer))
    const plan =
      publishIntent === undefined
        ? releasePlan
        : Plan.make({
            lifecycle: releasePlan.lifecycle,
            timestamp: releasePlan.timestamp,
            releases: releasePlan.releases,
            cascades: releasePlan.cascades,
            publishIntent,
          })
    const manifests = yield* rehearse(plan, rehearseOptions).pipe(
      Effect.provide(harness.workflowLayer),
    )

    return {
      manifests,
      publishCalls: yield* Ref.get(harness.publishCalls),
      packCalls: yield* Ref.get(harness.packCalls),
    }
  })

describe('artifact manifest', () => {
  const artifactCopyHelperSource = () => {
    const source = readFileSync(new URL('./executor/publish.ts', import.meta.url), 'utf8')
    const start = source.indexOf('const copyPackageDirectory =')
    const end = source.indexOf('\nconst workspaceVersionsFor', start)
    return source.slice(start, end)
  }

  test('records actual tarball bytes, packlist, and npm metadata from prepared artifacts', async () => {
    const manifests = await Effect.runPromise(
      makeManifestFromPrepared(plan, [artifact]).pipe(
        Effect.provide(Fs.Memory.layer({ [Fs.Path.toString(tarball)]: tarballBytes })),
      ),
    )

    expect(manifests).toHaveLength(1)
    expect(manifests[0]?.sha256).toEqual(sha256Bytes(tarballBytes))
    expect(manifests[0]?.planDigest.algorithm).toBe('sha256')
    expect(manifests[0]?.sizeBytes).toBe(4)
    expect(manifests[0]?.packlist.map((path) => Fs.Path.toString(path))).toEqual([
      './package.json',
      './dist/index.js',
    ])
    expect(manifests[0]?.npmRegistryIntegrity).toBe('sha512-npm')
    expect(manifests[0]?.npmRegistryShasum).toBe('npm-sha1')
  })

  test('writes and reads the plan-bound manifest path', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const manifests = yield* makeManifestFromPrepared(plan, [artifact])
        yield* writeManifest(plan, manifests)
        return yield* readManifest(plan)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({ [Fs.Path.toString(tarball)]: tarballBytes }),
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
          ),
        ),
      ),
    )

    expect(Option.isSome(result)).toBe(true)
    if (Option.isNone(result)) {
      throw new Error('expected artifact manifest')
    }
    expect(result.value[0]?.packageName.moniker).toBe('@kitz/core')
  })

  test('rehearsal writes artifact manifests without package-manager publish dry-run by default', async () => {
    const result = await Effect.runPromise(rehearseCorePackage())

    expect(result.manifests).toHaveLength(1)
    expect(result.packCalls).toHaveLength(1)
    expect(result.publishCalls).toEqual([])
  })

  test('rehearsal can prove the exact tarball publish command with package-manager dry-run', async () => {
    const result = await Effect.runPromise(
      rehearseCorePackage({ rehearseOptions: { publishDryRun: true } }),
    )

    expect(result.manifests).toHaveLength(1)
    expect(result.packCalls).toHaveLength(1)
    expect(result.publishCalls).toHaveLength(1)
    expect(result.publishCalls[0]!.dryRun).toBe(true)
    expect(result.publishCalls[0]!.ignoreScripts).toBe(true)
    const manifest = result.manifests[0]
    if (manifest === undefined) throw new Error('expected artifact manifest')
    expect(Fs.Path.toString(result.publishCalls[0]!.tarball)).toBe(
      `/repo/.release/artifacts/${manifest.planDigest.value}/kitz-core-1.1.0.tgz`,
    )
  })

  test('rehearsal does not trust manifests when publish dry-run fails', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({ failPublishPackages: ['@kitz/core'] })
        const releasePlan = yield* planOfficial([pkg]).pipe(Effect.provide(harness.planLayer))
        const error = yield* rehearse(releasePlan, { publishDryRun: true }).pipe(
          Effect.flip,
          Effect.provide(harness.workflowLayer),
        )
        const manifest = yield* readManifest(releasePlan).pipe(
          Effect.provide(harness.workflowLayer),
        )
        const publishCalls = yield* Ref.get(harness.publishCalls)

        return { error, manifest, publishCalls }
      }),
    )

    expect(result.error).toBeInstanceOf(PublishError)
    expect(result.publishCalls).toHaveLength(1)
    expect(Option.isNone(result.manifest)).toBe(true)
  })

  test('artifact preparation recursively stages package directories outside the source tree', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-artifact-stage-'))

    try {
      mkdirSync(path.join(rootDir, 'packages/core/src'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'packages/core/package.json'),
        makePackageJson('@kitz/core', '1.0.0'),
      )
      writeFileSync(path.join(rootDir, 'packages/core/src/index.ts'), 'export const value = 1\n')

      const packageRoot = Fs.Path.AbsDir.fromString(`${rootDir}/packages/core/`)
      const staged = await Effect.runPromise(
        Effect.gen(function* () {
          const artifact = yield* preparePackageArtifact(
            {
              package: {
                ...pkg,
                path: packageRoot,
              },
              nextVersion: Semver.fromString('1.1.0'),
            },
            [
              {
                package: {
                  ...pkg,
                  path: packageRoot,
                },
                nextVersion: Semver.fromString('1.1.0'),
              },
            ],
            { planDigest: 'proof-digest' },
          )
          const fs = yield* FileSystem.FileSystem
          const stagedSource = yield* fs.readFileString(
            `${rootDir}/.release/workspaces/kitz-core-1.1.0/src/index.ts`,
          )
          const sourceManifest = yield* fs.readFileString(`${rootDir}/packages/core/package.json`)
          return { artifact, stagedSource, sourceManifest }
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              FileSystemLayer,
              Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
              Layer.succeed(NpmRegistry.NpmCli, {
                whoami: () => Effect.succeed('mock-user'),
                pack: (options) =>
                  Effect.gen(function* () {
                    const manifest = readFileSync(
                      `${Fs.Path.toString(options.cwd)}package.json`,
                      'utf8',
                    )
                    const parsed = decodeJsonRecordSync(manifest)
                    const name = parsed['name']
                    const version = parsed['version']
                    if (typeof name !== 'string' || typeof version !== 'string') {
                      return yield* Effect.die('expected staged manifest name and version')
                    }
                    const tarball = Fs.Path.join(
                      options.packDestination,
                      Fs.Path.RelFile.fromString('./kitz-core-1.1.0.tgz'),
                    )
                    writeFileSync(Fs.Path.toString(tarball), `packed:${name}@${version}`)
                    return {
                      tarball,
                      filename: 'kitz-core-1.1.0.tgz',
                      files: [{ path: 'src/index.ts', size: 23 }],
                    }
                  }),
                publish: () => Effect.void,
                hasVersion: () => Effect.succeed(false),
                observeVersion: () => Effect.die('unexpected observeVersion'),
                listAccessPackages: () => Effect.succeed({}),
                listAccessCollaborators: () => Effect.succeed({}),
                getAccessStatus: () => Effect.succeed('public' as const),
              }),
            ),
          ),
        ),
      )

      expect(Fs.Path.toString(staged.artifact.tarball)).toBe(
        `${rootDir}/.release/artifacts/proof-digest/kitz-core-1.1.0.tgz`,
      )
      expect(staged.stagedSource).toBe('export const value = 1\n')
      expect(decodeJsonRecordSync(staged.sourceManifest)['version']).toBe('1.0.0')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('artifact staging copy stays on the typed filesystem facade', () => {
    const source = artifactCopyHelperSource()

    expect(source).toContain('Fs.read(')
    expect(source).toContain('Fs.write(')
    expect(source).not.toContain('yield* FileSystem.FileSystem')
    expect(source).not.toMatch(/\bfs\./u)
  })

  test('rehearsal rejects malformed source manifests before pack', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* makeCoreHarness({
          diskLayout: {
            '/repo/packages/core/package.json': '{bad json',
          },
        })
        const error = yield* rehearse(plan).pipe(Effect.flip, Effect.provide(harness.workflowLayer))
        const packCalls = yield* Ref.get(harness.packCalls)
        return { error, packCalls }
      }),
    )

    expect(result.packCalls).toEqual([])
    expect(result.error).toBeInstanceOf(PublishError)
  })

  test('rehearsal rejects unresolved catalog dependencies before pack', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          git: {
            tags: [tag(Pkg.Moniker.parse('@kitz/core'), '1.0.0')],
            commits: [Git.Memory.commit('feat(core): new API')],
            isClean: true,
          },
          diskLayout: {
            '/repo/package.json': JSON.stringify({ name: 'repo', catalog: {} }),
            '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0', {
              dependencies: {
                ansis: 'catalog:',
              },
            }),
          },
        })
        const releasePlan = yield* planOfficial([pkg]).pipe(Effect.provide(harness.planLayer))
        const error = yield* rehearse(releasePlan).pipe(
          Effect.flip,
          Effect.provide(harness.workflowLayer),
        )
        const packCalls = yield* Ref.get(harness.packCalls)
        return { error, packCalls }
      }),
    )

    expect(result.packCalls).toEqual([])
    if (!(result.error instanceof PublishError)) {
      throw new Error('expected PublishError')
    }
    expect(result.error.message).toContain('ansis')
  })

  test('rehearsal gives pack child processes only the plan-approved environment', async () => {
    const baseIntent = contractedPlan.publishIntent!
    const result = await Effect.runPromise(
      rehearseCorePackage({
        envVars: {
          PATH: '/bin:/usr/bin',
          HOME: '/Users/test',
          CI: 'true',
          NPM_TOKEN: 'secret',
          GITHUB_TOKEN: 'secret',
          NPM_CONFIG_OTP: '123456',
          RANDOM_UNRELATED_ENV: 'nope',
        },
        publishIntent: updatePublishIntent(baseIntent, {
          artifacts: updateArtifactPolicy(baseIntent.artifacts, {
            scriptPolicy: updateScriptPolicy(baseIntent.artifacts.scriptPolicy, {
              envAllowlist: ['CI'],
            }),
          }),
        }),
      }),
    )

    expect(result.packCalls[0]?.env).toEqual({
      PATH: '/bin:/usr/bin',
      HOME: '/Users/test',
      CI: 'true',
    })
    expect(packEnvironmentForPlan(contractedPlan, { NPM_TOKEN: 'secret' })).toEqual({})
  })

  test('rejects disallowed lifecycle scripts before rehearsal can pack artifacts', async () => {
    const packageJson = coreManifest({ scripts: { prepack: 'echo preparing' } })
    const issues = await scriptIssueCodes(contractedPlan, packageJson)

    expect(issues).toEqual(['release.artifact.lifecycle-script-disallowed'])

    const rehearseError = await Effect.runPromise(
      rehearse(contractedPlan).pipe(
        Effect.flip,
        Effect.provide(
          Layer.mergeAll(
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
            Fs.Memory.layer(coreDisk(packageJson)),
            Layer.succeed(NpmRegistry.NpmCli, {
              whoami: () => Effect.die('unexpected whoami'),
              pack: () => Effect.die('unexpected pack'),
              publish: () => Effect.die('unexpected publish'),
              hasVersion: () => Effect.die('unexpected hasVersion'),
              observeVersion: () => Effect.die('unexpected observeVersion'),
              listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
              listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
              getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
            }),
          ),
        ),
      ),
    )
    expect(rehearseError).toBeInstanceOf(PublishError)
    if (rehearseError instanceof PublishError) {
      expect('detail' in rehearseError.context ? rehearseError.context.detail : '').toContain(
        'lifecycle-script-disallowed',
      )
    }
  })

  test('accepts lifecycle scripts only when command and package source digests match', async () => {
    const { packageJson, plan } = allowlistedPrepackPlan('declared-deny')

    expect(await scriptIssueCodes(plan, packageJson)).toEqual([])
  })

  test('allowlisted lifecycle scripts still require an explicit network-denial answer', async () => {
    const { packageJson, plan } = allowlistedPrepackPlan('deny-enforced')

    expect(await scriptIssueCodes(plan, packageJson)).toEqual([
      'release.artifact.network-denial-unprovable',
    ])
  })

  test('enforces engine and package-manager policy before artifact construction', async () => {
    const strictPlan = makeContractedPlan({
      source: sourceSnapshot,
      publishIntent: updateContractedEnginePolicy({
        node: 'match-runtime',
        packageManager: 'match-plan',
      }),
    })

    const issues = await engineIssueCodes(
      strictPlan,
      coreDisk(coreManifest({ engines: { node: '20.0.0' }, packageManager: 'pnpm@11.0.0' })),
    )

    expect(issues).toEqual([
      'release.artifact.engine-node-mismatch',
      'release.artifact.package-manager-mismatch',
    ])

    const compatibleIssues = await engineIssueCodes(
      makeContractedPlan({
        source: sourceSnapshot,
        publishIntent: updateContractedEnginePolicy({
          node: 'allow-compatible-range',
          packageManager: 'allow-compatible-range',
        }),
      }),
      coreDisk(coreManifest({ engines: { node: '>=22.0.0' }, packageManager: 'bun@^1.3.0' })),
    )

    expect(compatibleIssues).toEqual([])
  })

  test('reports all engine policy input failures before pack can run', async () => {
    const strictPlan = makeContractedPlan({ source: sourceSnapshot })
    const unreadable = await engineIssueCodes(strictPlan, {})
    const malformed = await engineIssueCodes(strictPlan, coreDisk('{bad json'))
    const missingSource = await engineIssueCodes(
      makeContractedPlan(),
      coreDisk(coreManifest({ engines: { node: '22.14.0' }, packageManager: 'bun@1.3.6' })),
    )
    const invalidComparable = await engineIssueCodes(
      makeContractedPlan({
        source: sourceSnapshot,
        publishIntent: updateContractedEnginePolicy({
          node: 'allow-compatible-range',
          packageManager: 'allow-compatible-range',
        }),
      }),
      coreDisk(
        coreManifest({ engines: { node: 'not-a-range' }, packageManager: 'bun@not-a-range' }),
      ),
    )
    const invalidStrict = await engineIssueCodes(
      strictPlan,
      coreDisk(coreManifest({ engines: { node: 'not-a-semver' }, packageManager: 'bun' })),
    )
    const rehearseError = await Effect.runPromise(
      rehearse(strictPlan).pipe(
        Effect.flip,
        Effect.provide(
          Layer.mergeAll(
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
            Fs.Memory.layer(coreDisk(coreManifest({ engines: { node: '20.0.0' } }))),
            Layer.succeed(NpmRegistry.NpmCli, {
              whoami: () => Effect.die('unexpected whoami'),
              pack: () => Effect.die('unexpected pack'),
              publish: () => Effect.die('unexpected publish'),
              hasVersion: () => Effect.die('unexpected hasVersion'),
              observeVersion: () => Effect.die('unexpected observeVersion'),
              listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
              listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
              getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
            }),
          ),
        ),
      ),
    )

    expect(unreadable).toEqual(['release.artifact.package-json-unreadable'])
    expect(malformed).toEqual(['release.artifact.package-json-malformed'])
    expect(missingSource).toEqual([
      'release.artifact.engine-policy-source-missing',
      'release.artifact.package-manager-mismatch',
    ])
    expect(invalidComparable).toEqual([
      'release.artifact.engine-node-mismatch',
      'release.artifact.package-manager-mismatch',
    ])
    expect(invalidStrict).toEqual([
      'release.artifact.engine-node-mismatch',
      'release.artifact.package-manager-mismatch',
    ])
    expect(rehearseError).toBeInstanceOf(PublishError)
    if (rehearseError instanceof PublishError) {
      expect('detail' in rehearseError.context ? rehearseError.context.detail : '').toContain(
        'engine-node-mismatch',
      )
    }
  })

  test('validates plan digest, required release artifacts, forbidden files, and bytes', async () => {
    const manifests = await Effect.runPromise(
      makeManifestFromPrepared(plan, [artifact]).pipe(
        Effect.provide(Fs.Memory.layer({ [Fs.Path.toString(tarball)]: tarballBytes })),
      ),
    )

    expect(validateManifestForPlan(plan, manifests)).toEqual([])

    const fileIssues = await Effect.runPromise(
      validateManifestFilesForPlan(plan, manifests).pipe(
        Effect.provide(Fs.Memory.layer({ [Fs.Path.toString(tarball)]: new Uint8Array([9]) })),
      ),
    )

    expect(fileIssues.map((issue) => issue.code)).toContain('release.artifact.sha256-mismatch')
  })

  test('validates generated placeholder manifests and all static manifest issue shapes', async () => {
    const placeholder = makeManifestFromPlan(contractedPlan, Fs.Path.AbsDir.fromString('/repo/'))
    expect(Fs.Path.toString(placeholder[0]!.tarball)).toContain(
      `/.release/artifacts/${placeholder[0]!.planDigest.value}/kitz-core-1.0.0.tgz`,
    )

    const mismatched = updateArtifactManifest(placeholder[0]!, {
      planDigest: PlanDigest.make(sha256Text('other-plan')),
      packlist: [Fs.Path.RelFile.fromString('./.env')],
    })
    const policyPlan = Plan.make({
      lifecycle: contractedPlan.lifecycle,
      timestamp: contractedPlan.timestamp,
      releases: contractedPlan.releases,
      cascades: contractedPlan.cascades,
      publishIntent: updatePublishIntent(contractedPlan.publishIntent!, {
        artifacts: updateArtifactPolicy(contractedPlan.publishIntent!.artifacts, {
          forbiddenFilePatterns: ['.env'],
        }),
      }),
    })

    expect(validateManifestForPlan(policyPlan, [])).toEqual([
      expect.objectContaining({ code: 'release.artifact.missing-manifest' }),
    ])
    expect(validateManifestForPlan(policyPlan, [mismatched]).map((issue) => issue.code)).toEqual([
      'release.artifact.plan-digest-mismatch',
      'release.artifact.forbidden-file',
      'release.artifact.empty-tarball',
    ])

    const missingFileIssues = await Effect.runPromise(
      validateManifestFilesForPlan(contractedPlan, placeholder).pipe(
        Effect.provide(Fs.Memory.layer({})),
      ),
    )
    expect(missingFileIssues.map((issue) => issue.code)).toContain(
      'release.artifact.tarball-missing',
    )
  })

  test('reports unreadable and malformed package manifests for script policy checks', async () => {
    const unreadable = await Effect.runPromise(
      validateScriptPolicyForPlan(contractedPlan).pipe(Effect.provide(Fs.Memory.layer({}))),
    )
    const malformed = await Effect.runPromise(
      validateScriptPolicyForPlan(contractedPlan).pipe(
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/core/package.json': '{bad json',
          }),
        ),
      ),
    )

    expect(unreadable.map((issue) => issue.code)).toEqual([
      'release.artifact.package-json-unreadable',
    ])
    expect(malformed.map((issue) => issue.code)).toEqual([
      'release.artifact.package-json-malformed',
    ])
  })
})
