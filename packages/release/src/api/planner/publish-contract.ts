import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Effect, Schema } from 'effect'
import type { ResolvedConfig } from '../config.js'
import { sha256Json, sha256Text } from '../digest.js'
import {
  defaultProofPolicy,
  digestPlanBody,
  PlanBody,
  PlanSourceSnapshot,
  publishIntentFromSemantics,
} from '../release-contract.js'
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

export const validateSourceSnapshot = (
  source: PlanSourceSnapshot,
  cwd: Fs.Path.AbsDir,
): Effect.Effect<readonly SourceSnapshotIssue[], never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const current = yield* readLockfileDigests(cwd)
    const issues: SourceSnapshotIssue[] = []

    for (const expected of source.lockfiles) {
      const actual = current.find(
        (entry) => Fs.Path.toString(entry.path) === Fs.Path.toString(expected.path),
      )
      if (actual === undefined) {
        issues.push({
          code: 'release.source.lockfile-missing',
          detail: `${Fs.Path.toString(expected.path)} was present at plan time but is missing now.`,
        })
        continue
      }
      if (actual.digest.value !== expected.digest.value) {
        issues.push({
          code: 'release.source.lockfile-drift',
          detail: `${Fs.Path.toString(expected.path)} changed after the release plan was written.`,
        })
      }
    }

    for (const actual of current) {
      const expected = source.lockfiles.find(
        (entry) => Fs.Path.toString(entry.path) === Fs.Path.toString(actual.path),
      )
      if (expected === undefined) {
        issues.push({
          code: 'release.source.lockfile-added',
          detail: `${Fs.Path.toString(actual.path)} was added after the release plan was written.`,
        })
      }
    }

    return issues
  })

export const attachPublishContract = (params: {
  readonly plan: Plan
  readonly config: ResolvedConfig
  readonly tag?: string
  readonly registry?: string
  readonly signingProfileId?: string
}): Effect.Effect<Plan, never, Env.Env | FileSystem.FileSystem | Git.Git> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const rootPackageJson = yield* readJsonObject(
      Fs.Path.join(env.cwd, Fs.Path.RelFile.fromString('./package.json')),
    )
    const packageManagerValue = rootPackageJson['packageManager']
    const packageManager = splitPackageManager(
      typeof packageManagerValue === 'string' ? packageManagerValue : undefined,
    )
    const headSha = yield* git.getHeadSha().pipe(Effect.orElseSucceed(() => 'unknown'))
    const lockfileDigests = yield* readLockfileDigests(env.cwd)
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
      ...(params.registry !== undefined ? { registry: params.registry } : {}),
    })
    const source = PlanSourceSnapshot.make({
      headSha,
      trunk: params.config.trunk,
      releaseConfigDigest: sha256Json(params.config),
      releaseConfigDigestSource: 'canonical-effective-config',
      lockfiles: lockfileDigests,
      packageManager: {
        name: packageManager.name,
        version: packageManager.version,
        binary: packageManager.name,
        subcommands: {
          pack: true,
          publish: true,
        },
      },
      toolVersions: {
        [packageManager.name]: packageManager.version,
      },
    })
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

    return Plan.make({
      ...params.plan,
      schemaVersion: 2,
      signingProfileId,
      planDigest,
      source,
      publishIntent,
      proofPolicy,
    })
  })

export const withPublishIntent = attachPublishContract
