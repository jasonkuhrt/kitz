import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Effect, Schema } from 'effect'
import { ResolvedConfig } from '../config.js'
import { sha256Json, sha256Text } from '../digest.js'
import {
  defaultProofPolicy,
  digestPlanBody,
  PlanBody,
  PlanSourceSnapshot,
  publishIntentFromSemantics,
} from '../release-contract.js'
import { agentFromProjectManager } from '../publishing/driver.js'
import { resolvePublishSemanticsForPlan } from '../publishing.js'
import { Plan } from './models/plan.js'

const lockfiles = [
  './bun.lock',
  './bun.lockb',
  './pnpm-lock.yaml',
  './package-lock.json',
  './yarn.lock',
] as const

const JsonObjectFromString = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))

const splitPackageManager = (value: string | undefined): { name: string; version: string } => {
  if (value === undefined || value.trim() === '') return { name: 'unknown', version: 'unknown' }
  const separator = value.lastIndexOf(String.fromCharCode(64))
  if (separator <= 0) return { name: value, version: 'unknown' }
  return {
    name: value.slice(0, separator),
    version: value.slice(separator + 1),
  }
}

const readJsonObject = (
  path: Fs.Path.AbsFile,
): Effect.Effect<Readonly<Record<string, unknown>>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs
      .readFileString(Fs.Path.toString(path))
      .pipe(Effect.orElseSucceed(() => '{}'))
    return yield* Schema.decodeUnknownEffect(JsonObjectFromString)(content).pipe(
      Effect.orElseSucceed(() => ({})),
    )
  })

export interface SourceSnapshotIssue {
  readonly code: string
  readonly detail: string
}

export const readLockfileDigests = (
  cwd: Fs.Path.AbsDir,
): Effect.Effect<PlanSourceSnapshot['lockfiles'], never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const entries: Array<PlanSourceSnapshot['lockfiles'][number]> = []

    for (const lockfile of lockfiles) {
      const rel = Fs.Path.RelFile.fromString(lockfile)
      const abs = Fs.Path.join(cwd, rel)
      const exists = yield* fs.exists(Fs.Path.toString(abs)).pipe(Effect.orElseSucceed(() => false))
      if (!exists) continue
      const content = yield* fs
        .readFileString(Fs.Path.toString(abs))
        .pipe(Effect.orElseSucceed(() => ''))
      entries.push({ path: rel, digest: sha256Text(content) })
    }

    return entries
  })

const lockfileKey = (entry: PlanSourceSnapshot['lockfiles'][number]): string =>
  Fs.Path.toString(entry.path)

/**
 * Compare a plan's frozen source snapshot against a freshly observed snapshot
 * and report every drift that makes the plan stale: HEAD SHA, effective release
 * config digest, lockfiles, the package-manager toolchain (name/version/binary),
 * and recorded tool versions.
 *
 * Subcommand *invocation* proofs are deliberately out of scope here — those are
 * enforced by the plan-bound Proof gate that apply already requires
 * (`Proof.readForPlan` + `hasBlockingProof`), which proves `pack`/`publish`
 * against the live binary. The snapshot's `subcommands` field is static, so
 * comparing it here would never detect drift.
 *
 * Pure: build the observed snapshot with {@link buildSourceSnapshot}.
 */
export const validateSourceSnapshot = (
  source: PlanSourceSnapshot,
  observed: PlanSourceSnapshot,
): readonly SourceSnapshotIssue[] => {
  const issues: SourceSnapshotIssue[] = []

  if (observed.headSha !== source.headSha) {
    issues.push({
      code: 'release.source.head-sha-drift',
      detail: `HEAD was ${source.headSha} at plan time but is ${observed.headSha} now.`,
    })
  }

  if (observed.releaseConfigDigest.value !== source.releaseConfigDigest.value) {
    issues.push({
      code: 'release.source.config-digest-drift',
      detail: 'The effective release config changed after the release plan was written.',
    })
  }

  for (const expected of source.lockfiles) {
    const actual = observed.lockfiles.find((entry) => lockfileKey(entry) === lockfileKey(expected))
    if (actual === undefined) {
      issues.push({
        code: 'release.source.lockfile-missing',
        detail: `${lockfileKey(expected)} was present at plan time but is missing now.`,
      })
      continue
    }
    if (actual.digest.value !== expected.digest.value) {
      issues.push({
        code: 'release.source.lockfile-drift',
        detail: `${lockfileKey(expected)} changed after the release plan was written.`,
      })
    }
  }

  for (const actual of observed.lockfiles) {
    const expected = source.lockfiles.find((entry) => lockfileKey(entry) === lockfileKey(actual))
    if (expected === undefined) {
      issues.push({
        code: 'release.source.lockfile-added',
        detail: `${lockfileKey(actual)} was added after the release plan was written.`,
      })
    }
  }

  const expectedPm = source.packageManager
  const actualPm = observed.packageManager
  if (
    expectedPm.name !== actualPm.name ||
    expectedPm.version !== actualPm.version ||
    expectedPm.binary !== actualPm.binary
  ) {
    issues.push({
      code: 'release.source.toolchain-drift',
      detail: `Package manager was ${expectedPm.name}@${expectedPm.version} (${expectedPm.binary}) at plan time but is ${actualPm.name}@${actualPm.version} (${actualPm.binary}) now.`,
    })
  }

  for (const [tool, version] of Object.entries(source.toolVersions)) {
    if (observed.toolVersions[tool] !== version) {
      issues.push({
        code: 'release.source.tool-version-drift',
        detail: `Tool ${tool} was ${version} at plan time but is ${observed.toolVersions[tool] ?? 'absent'} now.`,
      })
    }
  }

  return issues
}

/**
 * Observe the current source snapshot — HEAD SHA, effective release config
 * digest, lockfile digests, and the package-manager toolchain. Used to freeze a
 * plan ({@link attachPublishContract}) and, with the same shape, to detect
 * staleness at apply ({@link validateSourceSnapshot}).
 */
export const buildSourceSnapshot = (params: {
  readonly config: ResolvedConfig
}): Effect.Effect<PlanSourceSnapshot, never, Env.Env | FileSystem.FileSystem | Git.Git> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const rootPackageJson = yield* readJsonObject(
      Fs.Path.join(env.cwd, Fs.Path.RelFile.fromString('./package.json')),
    )
    const packageManagerValue = rootPackageJson['packageManager']
    const declaredPackageManager = splitPackageManager(
      typeof packageManagerValue === 'string' ? packageManagerValue : undefined,
    )
    const detectedPackageManager = params.config.operator.manager.name
    const packageManagerVersion =
      declaredPackageManager.name === detectedPackageManager
        ? declaredPackageManager.version
        : 'unknown'
    const headSha = yield* git.getHeadSha().pipe(Effect.orElseSucceed(() => 'unknown'))
    const lockfileDigests = yield* readLockfileDigests(env.cwd)
    return PlanSourceSnapshot.make({
      headSha,
      trunk: params.config.trunk,
      // Digest the schema-encoded config (the established encode-first pattern),
      // not the raw class instance, so the digest never depends on Schema.Class
      // enumerable-field internals.
      releaseConfigDigest: sha256Json(ResolvedConfig.encodeSync(params.config)),
      releaseConfigDigestSource: 'canonical-effective-config',
      lockfiles: lockfileDigests,
      packageManager: {
        name: detectedPackageManager,
        version: packageManagerVersion,
        binary: detectedPackageManager,
        subcommands: {
          pack: true,
          publish: true,
        },
      },
      toolVersions: {
        [detectedPackageManager]: packageManagerVersion,
      },
    })
  })

export const attachPublishContract = (params: {
  readonly plan: Plan
  readonly config: ResolvedConfig
  readonly tag?: string
  readonly registry?: string
  readonly signingProfileId?: string
}): Effect.Effect<Plan, never, Env.Env | FileSystem.FileSystem | Git.Git> =>
  Effect.gen(function* () {
    const proofPolicy = params.plan.proofPolicy ?? defaultProofPolicy()
    const publishSemantics = resolvePublishSemanticsForPlan({
      plan: params.plan,
      publishing: params.config.publishing,
      ...(params.tag !== undefined ? { tag: params.tag } : {}),
      npmTag: params.config.npmTag,
      candidateTag: params.config.candidateTag,
    })
    const publishIntent = publishIntentFromSemantics({
      semantics: publishSemantics,
      trunk: params.config.trunk,
      packageManager: agentFromProjectManager(params.config.operator.manager.name),
      ...(params.registry !== undefined ? { registry: params.registry } : {}),
    })
    const source = yield* buildSourceSnapshot({ config: params.config })
    const signingProfileId =
      params.signingProfileId ?? params.plan.signingProfileId ?? 'local-developer'
    const body = PlanBody.make({
      schemaVersion: 2,
      signingProfileId,
      source,
      publishIntent,
      proofPolicy,
      releases: [...params.plan.releases, ...params.plan.cascades].map((item) => ({
        packageName: item.package.name,
        nextVersion: item.nextVersion,
      })),
    })
    const planDigest = digestPlanBody(body)

    return Plan.make(
      Object.assign({}, params.plan, {
        schemaVersion: 2,
        signingProfileId,
        planDigest,
        source,
        publishIntent,
        proofPolicy,
      }),
    )
  })

export const withPublishIntent = attachPublishContract
