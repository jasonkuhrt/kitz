import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import {
  Array as A,
  Effect,
  FileSystem,
  HashSet,
  Option,
  PlatformError,
  Record as EffectRecord,
  Result,
  Schema,
} from 'effect'
import { sha256Bytes, sha256Text } from './digest.js'
import {
  preparePackageArtifact,
  publishPreparedArtifact,
  PublishError,
  type PreparedArtifact,
  type ReleaseInfo,
} from './executor/publish.js'
import type { Plan } from './planner/models/plan.js'
import { digestForPlan } from './release-contract.js'
import { ArtifactManifest } from './release-contract.js'

const artifactDir = Fs.Path.RelDir.fromString('./.release/artifacts/')
const artifactManifestFile = Fs.Path.RelFile.fromString('./manifest.json')
const PackageJsonScriptsFromString = Schema.fromJsonString(
  Schema.Struct({
    scripts: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
    engines: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
    packageManager: Schema.optional(Schema.String),
  }),
)

const safePackEnvKeys = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP']

export const manifestPathFor = (cwd: Fs.Path.AbsDir, plan: Plan): Fs.Path.AbsFile =>
  Fs.Path.join(
    Fs.Path.join(cwd, artifactDir),
    Fs.Path.join(
      Fs.Path.RelDir.fromString(`./${digestForPlan(plan).value}/`),
      artifactManifestFile,
    ),
  )

const manifestRelPath = (path: string): Fs.Path.RelFile =>
  Fs.Path.RelFile.fromString(path.startsWith('./') ? path : `./${path}`)

export const releaseInfosForPlan = (plan: Plan): ReleaseInfo[] =>
  A.map([...plan.releases, ...plan.cascades], (item) => ({
    package: item.package,
    nextVersion: item.nextVersion,
  }))

export const makeManifestFromPrepared = (
  plan: Plan,
  artifacts: readonly PreparedArtifact[],
): Effect.Effect<ArtifactManifest[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const planDigest = digestForPlan(plan)

    const manifests = yield* Effect.forEach(artifacts, (artifact) =>
      Effect.gen(function* () {
        const tarballBytes = yield* fs.readFile(Fs.Path.toString(artifact.tarball))
        return ArtifactManifest.make({
          schemaVersion: 1,
          planDigest,
          packageName: artifact.package.name,
          version: artifact.nextVersion,
          driver: plan.publishIntent?.profile.packDriver ?? 'npm',
          tarball: artifact.tarball,
          sha256: sha256Bytes(tarballBytes),
          sizeBytes: tarballBytes.length,
          manifest: {
            name: artifact.package.name.moniker,
            version: Semver.toString(artifact.nextVersion),
          },
          packlist: A.map(artifact.packMetadata?.files ?? [], (file) => manifestRelPath(file.path)),
          rewrittenFields: ['version', 'dependencies', 'devDependencies', 'peerDependencies'],
          ...(artifact.packMetadata?.integrity !== undefined
            ? { npmRegistryIntegrity: artifact.packMetadata.integrity }
            : {}),
          ...(artifact.packMetadata?.shasum !== undefined
            ? { npmRegistryShasum: artifact.packMetadata.shasum }
            : {}),
        })
      }),
    )
    return [...manifests]
  })

export const makeManifestFromPlan = (plan: Plan, cwd: Fs.Path.AbsDir): ArtifactManifest[] =>
  A.map(releaseInfosForPlan(plan), (release) =>
    ArtifactManifest.make({
      schemaVersion: 1,
      planDigest: digestForPlan(plan),
      packageName: release.package.name,
      version: release.nextVersion,
      driver: plan.publishIntent?.profile.packDriver ?? 'npm',
      tarball: Fs.Path.AbsFile.fromString(
        `${Fs.Path.toString(cwd)}.release/artifacts/${digestForPlan(plan).value}/${release.package.name.moniker
          .replace(/^@/u, '')
          .replace(/\//gu, '-')}-${Semver.toString(release.nextVersion)}.tgz`,
      ),
      sha256: sha256Bytes(new Uint8Array()),
      sizeBytes: 0,
      manifest: {
        name: release.package.name.moniker,
        version: Semver.toString(release.nextVersion),
      },
      packlist: [],
      rewrittenFields: ['version'],
    }),
  )

export interface ArtifactIssue {
  readonly code: string
  readonly detail: string
}

const splitPackageManager = (value: string): { name: string; version: string } | null => {
  const separator = value.lastIndexOf(String.fromCharCode(64))
  if (separator <= 0) return null
  const name = value.slice(0, separator)
  const version = value.slice(separator + 1)
  return name.length > 0 && version.length > 0 ? { name, version } : null
}

const versionSatisfiesRange = (version: string, range: string): boolean => {
  try {
    return Pkg.Range.satisfies(Semver.fromString(version), Pkg.Range.fromString(range))
  } catch {
    return false
  }
}

const exactVersionMatches = (version: string, expected: string): boolean => {
  try {
    return Semver.equivalence(Semver.fromString(version), Semver.fromString(expected))
  } catch {
    return false
  }
}

export const packEnvironmentForPlan = (
  plan: Plan,
  vars: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> => {
  const allowlist = [
    ...safePackEnvKeys,
    ...(plan.publishIntent?.artifacts.scriptPolicy.envAllowlist ?? []),
  ]

  const allowed = HashSet.fromIterable(allowlist)

  return EffectRecord.filterMap(vars, (value, key) =>
    value !== undefined && HashSet.has(allowed, key) ? Result.succeed(value) : Result.failVoid,
  )
}

export const validateManifestForPlan = (
  plan: Plan,
  manifests: readonly ArtifactManifest[],
): readonly ArtifactIssue[] => {
  const planDigest = digestForPlan(plan)
  const releases = releaseInfosForPlan(plan)
  const issues: ArtifactIssue[] = []

  for (const manifest of manifests) {
    if (manifest.planDigest.value !== planDigest.value) {
      issues.push({
        code: 'release.artifact.plan-digest-mismatch',
        detail: `${manifest.packageName.moniker}@${manifest.version.toString()} was rehearsed for ${manifest.planDigest.value}, not ${planDigest.value}.`,
      })
    }

    const forbidden = plan.publishIntent?.artifacts.forbiddenFilePatterns ?? []
    for (const file of manifest.packlist) {
      const path = Fs.Path.toString(file)
      if (forbidden.some((pattern) => path.includes(pattern.replaceAll('*', '')))) {
        issues.push({
          code: 'release.artifact.forbidden-file',
          detail: `${manifest.packageName.moniker}@${manifest.version.toString()} includes forbidden file ${path}.`,
        })
      }
    }
  }

  for (const release of releases) {
    const manifest = manifests.find(
      (candidate) =>
        candidate.packageName.moniker === release.package.name.moniker &&
        candidate.version.toString() === release.nextVersion.toString(),
    )
    if (manifest === undefined) {
      issues.push({
        code: 'release.artifact.missing-manifest',
        detail: `${release.package.name.moniker}@${release.nextVersion.toString()} has no rehearsed artifact manifest.`,
      })
      continue
    }
    if (manifest.sizeBytes <= 0) {
      issues.push({
        code: 'release.artifact.empty-tarball',
        detail: `${release.package.name.moniker}@${release.nextVersion.toString()} produced an empty tarball.`,
      })
    }
  }

  return issues
}

export const validateManifestFilesForPlan = (
  plan: Plan,
  manifests: readonly ArtifactManifest[],
): Effect.Effect<readonly ArtifactIssue[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const baseIssues = validateManifestForPlan(plan, manifests)
    const fileIssues: ArtifactIssue[] = []

    for (const manifest of manifests) {
      const exists = yield* fs
        .exists(Fs.Path.toString(manifest.tarball))
        .pipe(Effect.orElseSucceed(() => false))
      if (!exists) {
        fileIssues.push({
          code: 'release.artifact.tarball-missing',
          detail: `${Fs.Path.toString(manifest.tarball)} is missing.`,
        })
        continue
      }
      const bytes = yield* fs.readFile(Fs.Path.toString(manifest.tarball))
      const actual = sha256Bytes(bytes)
      if (actual.value !== manifest.sha256.value) {
        fileIssues.push({
          code: 'release.artifact.sha256-mismatch',
          detail: `${Fs.Path.toString(manifest.tarball)} does not match the rehearsed SHA-256.`,
        })
      }
    }

    return [...baseIssues, ...fileIssues]
  })

export const validateScriptPolicyForPlan = (
  plan: Plan,
): Effect.Effect<readonly ArtifactIssue[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const policy = plan.publishIntent?.artifacts.scriptPolicy
    if (policy === undefined) return []

    const fs = yield* FileSystem.FileSystem
    const issues: ArtifactIssue[] = []

    for (const release of releaseInfosForPlan(plan)) {
      const packageJsonPath = Fs.Path.join(
        release.package.path,
        Fs.Path.RelFile.fromString('./package.json'),
      )
      const pathString = Fs.Path.toString(packageJsonPath)
      const raw = yield* fs.readFileString(pathString).pipe(Effect.result)

      if (Result.isFailure(raw)) {
        issues.push({
          code: 'release.artifact.package-json-unreadable',
          detail: `${pathString} could not be read for lifecycle-script policy validation.`,
        })
        continue
      }

      const parsed = yield* Schema.decodeUnknownEffect(PackageJsonScriptsFromString)(
        raw.success,
      ).pipe(Effect.option)

      if (Option.isNone(parsed)) {
        issues.push({
          code: 'release.artifact.package-json-malformed',
          detail: `${pathString} could not be parsed for lifecycle-script policy validation.`,
        })
        continue
      }

      const scripts = parsed.value.scripts ?? undefined
      const hooks = Pkg.Manifest.findPackHooks(
        scripts === undefined
          ? undefined
          : EffectRecord.filterMap(scripts, (value) =>
              typeof value === 'string' ? Result.succeed(value) : Result.failVoid,
            ),
      )

      for (const hook of hooks) {
        const command = scripts?.[hook]
        if (typeof command !== 'string') continue

        const commandSha256 = sha256Text(command)
        const packageSourceDigest = sha256Text(raw.success)
        const allowed = policy.allowlist.some(
          (entry) =>
            entry.packageName.moniker === release.package.name.moniker &&
            entry.script === hook &&
            entry.commandSha256.value === commandSha256.value &&
            entry.packageSourceDigest.value === packageSourceDigest.value,
        )

        if (policy.default === 'deny' || !allowed) {
          if (!allowed) {
            issues.push({
              code: 'release.artifact.lifecycle-script-disallowed',
              detail: `${release.package.name.moniker} defines ${hook}; add a matching command and package source digest to the publish artifact script allowlist or remove the hook before rehearsal.`,
            })
          }
        } else if (policy.network === 'deny-enforced') {
          issues.push({
            code: 'release.artifact.network-denial-unprovable',
            detail: `${release.package.name.moniker} defines allowlisted ${hook}, but no pack-time network-denial backend is active for the deny-enforced script policy.`,
          })
        }
      }
    }

    return issues
  })

export const validateEnginePolicyForPlan = (
  plan: Plan,
): Effect.Effect<readonly ArtifactIssue[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const policy = plan.publishIntent?.artifacts.enginePolicy
    if (policy === undefined) return []

    const fs = yield* FileSystem.FileSystem
    const issues: ArtifactIssue[] = []

    for (const release of releaseInfosForPlan(plan)) {
      const packageJsonPath = Fs.Path.join(
        release.package.path,
        Fs.Path.RelFile.fromString('./package.json'),
      )
      const pathString = Fs.Path.toString(packageJsonPath)
      const raw = yield* fs.readFileString(pathString).pipe(Effect.result)

      if (Result.isFailure(raw)) {
        issues.push({
          code: 'release.artifact.package-json-unreadable',
          detail: `${pathString} could not be read for engine policy validation.`,
        })
        continue
      }

      const parsed = yield* Schema.decodeUnknownEffect(PackageJsonScriptsFromString)(
        raw.success,
      ).pipe(Effect.option)

      if (Option.isNone(parsed)) {
        issues.push({
          code: 'release.artifact.package-json-malformed',
          detail: `${pathString} could not be parsed for engine policy validation.`,
        })
        continue
      }

      const nodeRange = parsed.value.engines?.['node']
      if (typeof nodeRange === 'string') {
        const runtimeNode = plan.source?.toolVersions['node']
        if (runtimeNode === undefined) {
          issues.push({
            code: 'release.artifact.engine-policy-source-missing',
            detail: `${release.package.name.moniker} declares engines.node but the plan source snapshot has no node runtime version.`,
          })
        } else {
          const matches =
            policy.node === 'match-runtime'
              ? exactVersionMatches(runtimeNode, nodeRange)
              : versionSatisfiesRange(runtimeNode, nodeRange)
          if (!matches) {
            issues.push({
              code: 'release.artifact.engine-node-mismatch',
              detail: `${release.package.name.moniker} declares engines.node=${nodeRange}, which does not satisfy planned node ${runtimeNode} under ${policy.node}.`,
            })
          }
        }
      }

      const packageManager = parsed.value.packageManager
      if (typeof packageManager === 'string') {
        const declared = splitPackageManager(packageManager)
        const planned = plan.source?.packageManager
        if (declared === null || planned === undefined) {
          issues.push({
            code: 'release.artifact.package-manager-mismatch',
            detail: `${release.package.name.moniker} declares packageManager=${packageManager}, but the plan does not contain a comparable package-manager source snapshot.`,
          })
        } else {
          const matches =
            declared.name === planned.name &&
            (policy.packageManager === 'match-plan'
              ? declared.version === planned.version
              : versionSatisfiesRange(planned.version, declared.version))
          if (!matches) {
            issues.push({
              code: 'release.artifact.package-manager-mismatch',
              detail: `${release.package.name.moniker} declares packageManager=${packageManager}, which does not match planned ${planned.name}@${planned.version} under ${policy.packageManager}.`,
            })
          }
        }
      }
    }

    return issues
  })

export const writeManifest = (
  plan: Plan,
  manifests: readonly ArtifactManifest[],
): Effect.Effect<void, PlatformError.PlatformError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const path = manifestPathFor(env.cwd, plan)
    yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(path)), { recursive: true })
    yield* fs.writeFileString(
      Fs.Path.toString(path),
      `${JSON.stringify(Schema.encodeSync(Schema.Array(ArtifactManifest))([...manifests]), null, 2)}\n`,
    )
  })

export const readManifest = (
  plan: Plan,
): Effect.Effect<
  Option.Option<readonly ArtifactManifest[]>,
  PlatformError.PlatformError | Schema.SchemaError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const path = manifestPathFor(env.cwd, plan)
    const exists = yield* fs.exists(Fs.Path.toString(path))
    if (!exists) return Option.none()
    const text = yield* fs.readFileString(Fs.Path.toString(path))
    const decoded = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(Schema.Array(ArtifactManifest)),
    )(text)
    return Option.some(decoded)
  })

export const rehearse = (
  plan: Plan,
): Effect.Effect<
  ArtifactManifest[],
  PublishError | PlatformError.PlatformError | Resource.ResourceError,
  Env.Env | FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const releases = releaseInfosForPlan(plan)
    const scriptPolicyIssues = yield* validateScriptPolicyForPlan(plan)
    if (scriptPolicyIssues.length > 0) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: releases[0]?.package.path ?? Fs.Path.AbsDir.fromString('/'),
            detail: A.map(scriptPolicyIssues, (issue) => `${issue.code}: ${issue.detail}`).join(
              '\n',
            ),
          },
        }),
      )
    }
    const enginePolicyIssues = yield* validateEnginePolicyForPlan(plan)
    if (enginePolicyIssues.length > 0) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: releases[0]?.package.path ?? Fs.Path.AbsDir.fromString('/'),
            detail: A.map(enginePolicyIssues, (issue) => `${issue.code}: ${issue.detail}`).join(
              '\n',
            ),
          },
        }),
      )
    }

    const planDigest = digestForPlan(plan).value
    const packEnv = packEnvironmentForPlan(plan, env.vars)
    const packDriver = plan.publishIntent?.profile.packDriver ?? 'npm'
    const publishInvoker = plan.publishIntent?.profile.publishInvoker ?? 'npm'
    const preparedArtifacts = yield* Effect.forEach(releases, (release) =>
      preparePackageArtifact(release, releases, {
        planDigest,
        packEnv,
        packageManager: packDriver,
      }),
    )

    const manifests = yield* makeManifestFromPrepared(plan, preparedArtifacts)

    for (const artifact of preparedArtifacts) {
      yield* publishPreparedArtifact(artifact, {
        dryRun: true,
        packageManager: publishInvoker,
        ...(plan.publishIntent !== undefined ? { tag: plan.publishIntent.distTag } : {}),
        ...(plan.publishIntent !== undefined ? { registry: plan.publishIntent.registry.url } : {}),
        ...(plan.publishIntent?.provenance.mode === 'cli-flag' ? { provenance: true } : {}),
        ...(plan.publishIntent?.provenance.mode === 'attestation-file' &&
        plan.publishIntent.provenance.file !== undefined
          ? { provenanceFile: plan.publishIntent.provenance.file }
          : {}),
      })
    }

    yield* writeManifest(plan, manifests)
    return manifests
  })
