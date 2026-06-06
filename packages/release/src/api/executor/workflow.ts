/**
 * @module executor/workflow
 *
 * Declarative DAG definition for the release workflow using @kitz/flo.
 *
 * Graph structure:
 * ```
 * Prepare:A ---+--> Publish:A --> VerifyPublish:A --> CreateTag:A --> PushTag:A --> CreateGHRelease:A
 * Prepare:B ---+--> Publish:B --> VerifyPublish:B --> CreateTag:B --> PushTag:B --> CreateGHRelease:B
 * Prepare:C ---+--> Publish:C --> VerifyPublish:C --> CreateTag:C --> PushTag:C --> CreateGHRelease:C
 * ```
 */

import { ConventionalCommits } from '@kitz/conventional-commits'
import { Flo } from '@kitz/flo'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { PlatformError, Effect, FileSystem, Option, Schema } from 'effect'
import * as Notes from '../notes/__.js'
import { Digest, sha256Bytes } from '../digest.js'
import { formatGithubReleaseTitle, Publishing, resolvePublishSemantics } from '../publishing.js'
import {
  ArtifactManifest,
  PlanDigest,
  PublishReceipt,
  RegistryObservation,
} from '../release-contract.js'
import { verifyRegistryObservation } from '../publishing/verification.js'
import { PublishDriverId } from '../publishing/models/driver-id.js'
import { EphemeralSchema } from '../version/models/ephemeral.js'
import { LifecycleSchema } from '../version/models/lifecycle.js'
import {
  ExecutorBeforeMutationError,
  ExecutorError as ExecutorErrorSchema,
  ExecutorGHReleaseError,
  ExecutorPublishError,
  ExecutorTagError,
} from './errors.js'
import * as Journal from '../journal.js'
import type { ExecutorError } from './errors.js'
import {
  artifactPathFor,
  preparePackageArtifact,
  publishPreparedArtifact,
  PublishError,
  type ReleaseInfo,
} from './publish.js'

/** Format a release tag from package name and version. */
export const formatTag = (name: Pkg.Moniker.Moniker, version: Semver.Semver): string =>
  Pkg.Pin.toString(Pkg.Pin.Exact.make({ name, version }))

// ============================================================================
// Payload Schema
// ============================================================================

/**
 * Schema for a structured commit entry.
 */
export const CommitEntrySchema = Schema.Struct({
  type: Schema.String,
  message: Schema.String,
  hash: Git.Sha.Sha,
  breaking: Schema.Boolean,
})

/**
 * Schema for a single release in the payload.
 */
export const ReleaseSchema = Schema.Struct({
  packageName: Schema.String,
  packagePath: Schema.String,
  currentVersion: Schema.OptionFromNullOr(Schema.String),
  nextVersion: Schema.String,
  bump: Schema.UndefinedOr(Schema.Literals(['major', 'minor', 'patch'])),
  commits: Schema.Array(CommitEntrySchema),
  dependsOn: Schema.Array(Schema.String),
})

/**
 * Payload for the release workflow.
 */
export const ReleasePayload = Schema.Struct({
  releases: Schema.Array(ReleaseSchema),
  options: Schema.Struct({
    dryRun: Schema.Boolean,
    tag: Schema.optional(Schema.String),
    registry: Schema.optional(Schema.String),
    access: Schema.optional(Schema.Literals(['public', 'restricted'])),
    planDigest: Schema.optional(Schema.String),
    rehearsedArtifacts: Schema.Boolean,
    atomicTagPush: Schema.Boolean,
    lifecycle: Schema.optional(LifecycleSchema),
    publishing: Schema.optional(Publishing),
    trunk: Schema.optional(Schema.String),
    packDriver: PublishDriverId,
    publishInvoker: PublishDriverId,
  }),
})

export type ReleasePayloadType = typeof ReleasePayload.Type

const releaseWorkflowIdempotencyKey = (payload: ReleasePayloadType): string =>
  JSON.stringify({
    options: {
      dryRun: payload.options.dryRun,
      tag: payload.options.tag ?? null,
      registry: payload.options.registry ?? null,
      access: payload.options.access ?? null,
      planDigest: payload.options.planDigest ?? null,
      rehearsedArtifacts: payload.options.rehearsedArtifacts,
      atomicTagPush: payload.options.atomicTagPush,
      lifecycle: payload.options.lifecycle ?? null,
      trunk: payload.options.trunk ?? null,
      packDriver: payload.options.packDriver,
      publishInvoker: payload.options.publishInvoker,
    },
    releases: payload.releases
      .toSorted((a, b) => a.packageName.localeCompare(b.packageName))
      .map((release) => ({
        packageName: release.packageName,
        nextVersion: release.nextVersion,
        currentVersion: release.currentVersion,
        bump: release.bump,
        dependsOn: release.dependsOn.toSorted(),
        commits: release.commits.map((commit) => ({
          hash: commit.hash,
          type: commit.type,
          breaking: commit.breaking,
        })),
      })),
  })

// ============================================================================
// Activity Helpers
// ============================================================================

/**
 * Convert a workflow release payload to ReleaseInfo for publishing.
 */
export const toReleaseInfo = (release: ReleasePayloadType['releases'][number]): ReleaseInfo => ({
  package: {
    name: Pkg.Moniker.parse(release.packageName),
    path: Fs.Path.AbsDir.fromString(release.packagePath),
    scope: release.packageName.startsWith('@')
      ? release.packageName.split('/')[1]!
      : release.packageName,
  },
  nextVersion: Semver.fromString(release.nextVersion),
})

/**
 * Generic, proof-blind identity of a mutation the executor is about to run.
 * Names nothing from the proof layer: the executor hands this to an injected
 * {@link BeforeMutationHook} and never inspects what the hook does with it.
 */
export interface MutationContext {
  /**
   * The mutating side-effect kind this hook is gating. The release workflow
   * drives the gate for five of the {@link Journal.SideEffectInput} kinds —
   * `registry-publish`, `git-tag-create`, `git-tag-push`,
   * `github-release-create`, and `github-release-update`. A single-package
   * official release exercises four of them (no pre-existing release to update).
   */
  readonly kind: Journal.SideEffectInput['kind']
  /** The mutation subject — the pin tag (or comma-joined tags for an atomic push). */
  readonly subject: string
  /** The planned payload already recorded for this mutation's journal entry. */
  readonly planned: Readonly<Record<string, unknown>>
}

/**
 * An injected gate the executor runs immediately before each mutating node,
 * passing only generic {@link MutationContext}. The executor is proof-blind: it
 * treats the hook as an opaque allow/abort gate. A failure aborts the mutation
 * before any side effect runs (the durable workflow suspends, resumable). The
 * caller (the apply boundary) owns the gate's meaning — it closes over the
 * proof artifact and drives a pre-mutation proof recheck inside the hook.
 */
export type BeforeMutationHook = (
  ctx: MutationContext,
) => Effect.Effect<void, ExecutorBeforeMutationError, Git.Git | NpmRegistry.NpmCli>

/** True for an error the before-mutation gate raised (which must abort cleanly). */
const isBeforeMutationError = (e: unknown): e is ExecutorBeforeMutationError =>
  (e as { readonly _tag?: string })._tag === 'ExecutorBeforeMutationError'

const recordSideEffect = <E, R>(params: {
  readonly payload: ReleasePayloadType
  readonly kind: Journal.SideEffectInput['kind']
  readonly subject: string
  readonly planned: Readonly<Record<string, unknown>>
  readonly beforeMutation?: BeforeMutationHook | undefined
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- side-effect recording preserves the wrapped operation's native error channel.
  readonly effect: Effect.Effect<string, E, R>
}): Effect.Effect<
  string,
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- side-effect recording preserves the wrapped operation's native error channel and adds the gate's tagged error.
  E | ExecutorBeforeMutationError,
  R | Env.Env | FileSystem.FileSystem | Git.Git | NpmRegistry.NpmCli
> => {
  if (params.payload.options.dryRun || params.payload.options.planDigest === undefined) {
    return params.effect
  }

  return Effect.gen(function* () {
    // Run the injected before-mutation gate BEFORE the 'attempting' journal
    // write so a rejected mutation is journal-invisible: no `attempting` entry
    // is orphaned, and no `failed` entry is written for a mutation that never
    // started. This placement is load-bearing for the #239 audit journal — a
    // recheck-on-resume that blocks here must not write a journal entry, and a
    // recheck that passes on resume must not double-journal (the durable engine
    // skips already-completed nodes, so this gate only fires for the single
    // not-yet-completed mutation the workflow is resuming into; #239 journal
    // dedup is NOT built here — that lands with #239).
    if (params.beforeMutation !== undefined) {
      yield* params.beforeMutation({
        kind: params.kind,
        subject: params.subject,
        planned: params.planned,
      })
    }
    yield* Journal.appendSideEffect({
      planDigest: params.payload.options.planDigest!,
      kind: params.kind,
      subject: params.subject,
      planned: params.planned,
      result: 'attempting',
    }).pipe(Effect.orDie)
    return yield* params.effect.pipe(
      Effect.tap(() =>
        Journal.appendSideEffect({
          planDigest: params.payload.options.planDigest!,
          kind: params.kind,
          subject: params.subject,
          planned: params.planned,
          result: 'succeeded',
        }).pipe(Effect.orDie),
      ),
      Effect.tapError((error) =>
        Journal.appendSideEffect({
          planDigest: params.payload.options.planDigest!,
          kind: params.kind,
          subject: params.subject,
          planned: {
            ...params.planned,
            error: error instanceof Error ? error.message : String(error),
          },
          result: 'failed',
        }).pipe(Effect.orDie),
      ),
    )
  })
}

const legacyCandidateSemantics = (distTag: string) =>
  resolvePublishSemantics({
    lifecycle: 'candidate',
    tag: distTag,
  })

const resolvePayloadPrNumber = (payload: ReleasePayloadType): number | undefined => {
  if (payload.options.lifecycle !== 'ephemeral') return undefined

  for (const release of payload.releases) {
    const prerelease = Semver.getPrerelease(Semver.fromString(release.nextVersion))
    if (prerelease === undefined) continue

    const decoded = Schema.decodeUnknownOption(EphemeralSchema)(prerelease.join('.'))
    if (Option.isSome(decoded)) return decoded.value.prNumber
  }

  return undefined
}

const assertRehearsedArtifactExists = (
  release: ReleaseInfo,
  planDigest: string | undefined,
): Effect.Effect<
  void,
  PublishError | PlatformError.PlatformError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const artifact = artifactPathFor(
      env.cwd,
      release,
      planDigest === undefined ? undefined : { planDigest },
    )
    const artifactPath = Fs.Path.toString(artifact)
    const exists = yield* fs.exists(artifactPath).pipe(Effect.orElseSucceed(() => false))
    if (!exists) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: `Rehearsed artifact is missing at ${artifactPath}. Run \`release rehearse\` before \`release apply\`.`,
          },
        }),
      )
    }

    const bytes = yield* fs.readFile(artifactPath)
    if (bytes.length === 0) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: `Rehearsed artifact is empty at ${artifactPath}. Run \`release rehearse\` before \`release apply\`.`,
          },
        }),
      )
    }
  })

// ============================================================================
// Workflow Definition (Declarative DAG)
// ============================================================================

/**
 * The main release workflow using declarative DAG execution.
 *
 * - Fresh-run preflight happens outside the durable workflow
 * - The DAG is executed single-flight within each layer for clean suspension/resume
 * - Publish starts only after every Prepare completes successfully
 * - Publish ordering respects local package dependency edges from the payload
 * - Each CreateTag runs after its corresponding Publish
 * - Each PushTag runs after its corresponding CreateTag
 * - Each CreateGHRelease runs after its corresponding PushTag
 */
/**
 * Build the release workflow, optionally injecting a proof-blind
 * {@link BeforeMutationHook}. The hook (when supplied) is captured by the
 * `graph` closure and forwarded to every mutating side-effect boundary, so it
 * runs immediately before each mutating node. Passing no hook
 * yields the un-gated workflow (the graph structure is identical either way —
 * the hook only affects runtime behavior inside node effects, never the DAG).
 */
export const makeReleaseWorkflow = (beforeMutation?: BeforeMutationHook) =>
  Flo.Workflow.make({
    name: 'ReleaseWorkflow',
    payload: ReleasePayload,
    error: ExecutorErrorSchema,
    idempotencyKey: releaseWorkflowIdempotencyKey,
    layerConcurrency: 1,

    graph: (payload, node) => {
      const prNumber = resolvePayloadPrNumber(payload)
      const publishSemantics =
        payload.options.lifecycle !== undefined
          ? resolvePublishSemantics({
              lifecycle: payload.options.lifecycle,
              ...(payload.options.publishing !== undefined
                ? { publishing: payload.options.publishing }
                : {}),
              ...(payload.options.tag !== undefined ? { tag: payload.options.tag } : {}),
              ...(prNumber !== undefined ? { prNumber } : {}),
            })
          : undefined
      const plannedReleases = payload.releases.map(toReleaseInfo)

      const prepares = payload.releases.map((release) =>
        node(
          `Prepare:${release.packageName}`,
          Effect.gen(function* () {
            const releaseInfo = toReleaseInfo(release)

            const tag = formatTag(releaseInfo.package.name, releaseInfo.nextVersion)
            if (payload.options.dryRun) {
              yield* Effect.log(`[dry-run] Would prepare ${tag}`)
            } else if (payload.options.rehearsedArtifacts) {
              yield* Effect.log(`Using rehearsed artifact for ${tag}...`)
              yield* assertRehearsedArtifactExists(releaseInfo, payload.options.planDigest)
            } else {
              yield* Effect.log(`Preparing ${tag}...`)
              yield* preparePackageArtifact(releaseInfo, plannedReleases, {
                packageManager: payload.options.packDriver,
                ...(payload.options.planDigest === undefined
                  ? {}
                  : { planDigest: payload.options.planDigest }),
              })
            }

            return release.packageName
          }).pipe(
            Effect.mapError(
              (e) =>
                new ExecutorPublishError({
                  context: {
                    packageName: release.packageName,
                    detail: e instanceof Error ? e.message : String(e),
                  },
                }),
            ),
          ),
          {},
        ),
      )

      const publishHandles: Array<{
        readonly packageName: string
        readonly handle: Flo.Workflow.NodeHandle<string>
      }> = []

      // Layer 1: Publish prepared tarballs after all preparation succeeds.
      const publishes = payload.releases.map((release) => {
        const dependencies = release.dependsOn
          .map(
            (dependencyName) =>
              publishHandles.find((entry) => entry.packageName === dependencyName)?.handle,
          )
          .filter(
            (dependency): dependency is Flo.Workflow.NodeHandle<string> => dependency !== undefined,
          )
        const after = [...prepares, ...dependencies]

        const handle = node(
          `Publish:${release.packageName}`,
          Effect.gen(function* () {
            const releaseInfo = toReleaseInfo(release)
            const tag = formatTag(releaseInfo.package.name, releaseInfo.nextVersion)
            const publishTag = publishSemantics?.distTag ?? payload.options.tag

            if (payload.options.dryRun) {
              yield* Effect.log(`[dry-run] Would publish ${tag}`)
            } else {
              const env = yield* Env.Env
              yield* Effect.log(`Publishing ${tag}...`)
              yield* recordSideEffect({
                payload,
                kind: 'registry-publish',
                subject: tag,
                beforeMutation,
                planned: {
                  packageName: release.packageName,
                  version: release.nextVersion,
                  distTag: publishTag ?? null,
                  registry: payload.options.registry ?? null,
                },
                effect: publishPreparedArtifact(
                  {
                    ...releaseInfo,
                    tarball: artifactPathFor(
                      env.cwd,
                      releaseInfo,
                      payload.options.planDigest === undefined
                        ? undefined
                        : { planDigest: payload.options.planDigest },
                    ),
                  },
                  {
                    ...(publishTag !== undefined ? { tag: publishTag } : {}),
                    ...(payload.options.registry && { registry: payload.options.registry }),
                    ...(payload.options.access !== undefined
                      ? { access: payload.options.access }
                      : {}),
                    packageManager: payload.options.publishInvoker,
                  },
                ).pipe(Effect.as(release.packageName)),
              })
            }

            return release.packageName
          }).pipe(
            Effect.mapError((e): ExecutorPublishError | ExecutorBeforeMutationError => {
              if (isBeforeMutationError(e)) return e
              return new ExecutorPublishError({
                context: {
                  packageName: release.packageName,
                  detail: e instanceof Error ? e.message : String(e),
                },
              })
            }),
          ),
          after.length > 0 ? { after } : undefined,
        )

        publishHandles.push({ packageName: release.packageName, handle })
        return handle
      })

      const verifyPublishes = payload.releases.map((release, i) =>
        node(
          `VerifyPublish:${release.packageName}`,
          Effect.gen(function* () {
            if (payload.options.dryRun) {
              yield* Effect.log(
                `[dry-run] Would verify registry version: ${release.packageName}@${release.nextVersion}`,
              )
              return release.packageName
            }

            yield* Effect.log(
              `Verifying registry version: ${release.packageName}@${release.nextVersion}`,
            )
            const env = yield* Env.Env
            const fs = yield* FileSystem.FileSystem
            const cli = yield* NpmRegistry.NpmCli
            const releaseInfo = toReleaseInfo(release)
            const tarball = artifactPathFor(
              env.cwd,
              releaseInfo,
              payload.options.planDigest === undefined
                ? undefined
                : { planDigest: payload.options.planDigest },
            )
            const tarballBytes = yield* fs.readFile(Fs.Path.toString(tarball))
            const tarballSha256 = sha256Bytes(tarballBytes)
            const publishTag = publishSemantics?.distTag ?? payload.options.tag ?? 'latest'
            const observed = yield* cli.observeVersion(release.packageName, release.nextVersion, {
              ...(payload.options.registry !== undefined
                ? { registry: payload.options.registry }
                : {}),
              downloadTarball: payload.options.lifecycle === 'official',
            })
            const planDigest = PlanDigest.make({
              algorithm: 'sha256',
              value: payload.options.planDigest ?? 'unknown',
            })
            const observation = RegistryObservation.make({
              packageName: Pkg.Moniker.parse(release.packageName),
              version: Semver.fromString(release.nextVersion),
              registry: payload.options.registry ?? 'https://registry.npmjs.org/',
              observedAt: new Date().toISOString(),
              versionMetadata: observed.versionMetadata,
              distTags: { ...observed.distTags },
              ...(observed.tarballUrl !== undefined ? { tarballUrl: observed.tarballUrl } : {}),
              ...(observed.shasum !== undefined ? { shasum: observed.shasum } : {}),
              ...(observed.integrity !== undefined ? { integrity: observed.integrity } : {}),
              ...(observed.downloadedTarballSha256 !== undefined
                ? {
                    downloadedTarballSha256: Digest.make({
                      algorithm: 'sha256',
                      value: observed.downloadedTarballSha256,
                    }),
                  }
                : {}),
            })
            const receipt = PublishReceipt.make({
              schemaVersion: 1,
              planDigest,
              tarballSha256,
              observation,
              verifiedAt: new Date().toISOString(),
            })
            const artifact = ArtifactManifest.make({
              schemaVersion: 1,
              planDigest,
              packageName: releaseInfo.package.name,
              version: releaseInfo.nextVersion,
              driver: payload.options.packDriver,
              tarball,
              sha256: tarballSha256,
              sizeBytes: tarballBytes.length,
              manifest: {
                name: release.packageName,
                version: release.nextVersion,
              },
              packlist: [],
              rewrittenFields: ['version', 'dependencies', 'devDependencies', 'peerDependencies'],
            })
            const verification = verifyRegistryObservation({
              artifact,
              observation,
              distTag: publishTag,
              official: payload.options.lifecycle === 'official',
              ...(payload.options.access !== undefined
                ? { requestedAccess: payload.options.access }
                : {}),
              receipt,
            })
            if (verification.issues.length > 0) {
              return yield* Effect.fail(
                new ExecutorPublishError({
                  context: {
                    packageName: release.packageName,
                    detail: verification.issues.map((issue) => issue.detail).join('\n'),
                  },
                }),
              )
            }

            return release.packageName
          }).pipe(
            Effect.mapError((e): ExecutorPublishError => {
              if ((e as { readonly _tag?: string })._tag === 'ExecutorPublishError') {
                return e as ExecutorPublishError
              }
              return new ExecutorPublishError({
                context: {
                  packageName: release.packageName,
                  detail: e instanceof Error ? e.message : String(e),
                },
              })
            }),
          ),
          { after: publishes[i]! },
        ),
      )

      // Layer 2: Create git tags (each depends on its corresponding verified publish)
      const createTags = payload.releases.map((release, i) => {
        const tag = formatTag(
          Pkg.Moniker.parse(release.packageName),
          Semver.fromString(release.nextVersion),
        )
        return node(
          `CreateTag:${tag}`,
          Effect.gen(function* () {
            if (payload.options.dryRun) {
              yield* Effect.log(`[dry-run] Would create tag: ${tag}`)
            } else {
              yield* Effect.log(`Creating tag: ${tag}`)
              const gitService = yield* Git.Git
              yield* recordSideEffect({
                payload,
                kind: 'git-tag-create',
                subject: tag,
                beforeMutation,
                planned: { tag, message: `Release ${tag}` },
                effect: gitService.createTag(tag, `Release ${tag}`).pipe(Effect.as(tag)),
              })
            }
            return tag
          }).pipe(
            Effect.mapError((e): ExecutorTagError | ExecutorBeforeMutationError => {
              if (isBeforeMutationError(e)) return e
              return new ExecutorTagError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              })
            }),
          ),
          { after: verifyPublishes[i]! },
        )
      })

      // Layer 3: Push tags after local tag creation. Official contracted
      // multi-package releases use one atomic push so no remote receives a
      // partial tag set.
      const shouldAtomicPushTags =
        payload.options.atomicTagPush && payload.releases.length > 1 && !payload.options.dryRun
      const atomicPushTagHandle = shouldAtomicPushTags
        ? node(
            `PushTagsAtomic:${payload.releases.length}`,
            Effect.gen(function* () {
              const tags = payload.releases.map((release) =>
                formatTag(
                  Pkg.Moniker.parse(release.packageName),
                  Semver.fromString(release.nextVersion),
                ),
              )
              yield* Effect.log(`Pushing ${tags.length} tags atomically`)
              const gitService = yield* Git.Git
              yield* recordSideEffect({
                payload,
                kind: 'git-tag-push',
                subject: tags.join(','),
                beforeMutation,
                planned: { tags, remote: 'origin', atomic: true },
                effect: gitService
                  .pushTagsAtomic(tags, 'origin', false)
                  .pipe(Effect.as(tags.join(','))),
              })
              return tags.join(',')
            }).pipe(
              Effect.mapError((e): ExecutorTagError | ExecutorBeforeMutationError => {
                if (isBeforeMutationError(e)) return e
                return new ExecutorTagError({
                  context: {
                    tag: 'atomic-tag-push',
                    detail: e instanceof Error ? e.message : String(e),
                  },
                })
              }),
            ),
            { after: createTags },
          )
        : undefined

      const pushTags = payload.releases.map((release, i) => {
        const tag = formatTag(
          Pkg.Moniker.parse(release.packageName),
          Semver.fromString(release.nextVersion),
        )
        if (atomicPushTagHandle !== undefined) return atomicPushTagHandle

        return node(
          `PushTag:${tag}`,
          Effect.gen(function* () {
            if (payload.options.dryRun) {
              yield* Effect.log(`[dry-run] Would push tag: ${tag}`)
            } else {
              yield* Effect.log(`Pushing tag: ${tag}`)
              const gitService = yield* Git.Git
              const force =
                publishSemantics?.forcePushTag ??
                (payload.options.lifecycle === undefined && payload.options.tag === 'next')
              yield* recordSideEffect({
                payload,
                kind: 'git-tag-push',
                subject: tag,
                beforeMutation,
                planned: { tag, remote: 'origin', force },
                effect: gitService.pushTag(tag, 'origin', force).pipe(Effect.as(tag)),
              })
            }
            return tag
          }).pipe(
            Effect.mapError((e): ExecutorTagError | ExecutorBeforeMutationError => {
              if (isBeforeMutationError(e)) return e
              return new ExecutorTagError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              })
            }),
          ),
          { after: createTags[i]! },
        )
      })

      // Layer 4: Create GitHub releases (each depends on its corresponding pushTag)
      const createGHReleases = payload.releases.map((release, i) => {
        const nextVersion = Semver.fromString(release.nextVersion)
        const tag = formatTag(Pkg.Moniker.parse(release.packageName), nextVersion)
        const legacyCandidateDistTag =
          payload.options.lifecycle === undefined && payload.options.tag === 'next'
            ? 'next'
            : undefined
        const isPrereleaseVersion = Semver.getPrerelease(nextVersion) !== undefined
        return node(
          `CreateGHRelease:${tag}`,
          Effect.gen(function* () {
            if (payload.options.dryRun) {
              yield* Effect.log(`[dry-run] Would create GH release: ${tag}`)
              return tag
            }

            yield* Effect.log(`Creating GH release: ${tag}`)

            // Generate changelog for release body
            const changelog = yield* Notes.format({
              scope: release.packageName,
              commits: release.commits.map((c) => ({
                ...c,
                type: ConventionalCommits.Type.parse(c.type),
              })),
              newVersion: release.nextVersion,
            })

            const gh = yield* Github.Github

            if (
              publishSemantics?.githubReleaseStyle === 'dist-tagged' ||
              legacyCandidateDistTag !== undefined
            ) {
              const distTag = publishSemantics?.distTag ?? legacyCandidateDistTag!
              const exists = yield* gh.releaseExists(tag)

              if (exists) {
                yield* Effect.log(`Updating existing candidate release: ${tag}`)
                const title = formatGithubReleaseTitle(
                  publishSemantics ?? legacyCandidateSemantics(distTag),
                  {
                    packageName: release.packageName,
                    version: release.nextVersion,
                  },
                )
                yield* recordSideEffect({
                  payload,
                  kind: 'github-release-update',
                  subject: tag,
                  beforeMutation,
                  planned: { tag, title, prerelease: true },
                  effect: gh
                    .updateRelease(tag, { title, body: changelog.markdown })
                    .pipe(Effect.as(tag)),
                })
              } else {
                const title = formatGithubReleaseTitle(
                  publishSemantics ?? legacyCandidateSemantics(distTag),
                  {
                    packageName: release.packageName,
                    version: release.nextVersion,
                  },
                )
                yield* recordSideEffect({
                  payload,
                  kind: 'github-release-create',
                  subject: tag,
                  beforeMutation,
                  planned: { tag, title, prerelease: true },
                  effect: gh
                    .createRelease({
                      tag,
                      title,
                      body: changelog.markdown,
                      prerelease: true,
                    })
                    .pipe(Effect.as(tag)),
                })
              }
            } else {
              const releaseSemantics =
                publishSemantics ??
                resolvePublishSemantics({
                  lifecycle: isPrereleaseVersion ? 'ephemeral' : 'official',
                  ...(payload.options.tag !== undefined ? { tag: payload.options.tag } : {}),
                })
              const title = formatGithubReleaseTitle(releaseSemantics, {
                packageName: release.packageName,
                version: release.nextVersion,
              })
              const prerelease = releaseSemantics.prerelease || isPrereleaseVersion
              yield* recordSideEffect({
                payload,
                kind: 'github-release-create',
                subject: tag,
                beforeMutation,
                planned: { tag, title, prerelease },
                effect: gh
                  .createRelease({
                    tag,
                    title,
                    body: changelog.markdown,
                    ...(prerelease ? { prerelease: true } : {}),
                  })
                  .pipe(Effect.as(tag)),
              })
            }

            return tag
          }).pipe(
            Effect.mapError((e): ExecutorGHReleaseError | ExecutorBeforeMutationError => {
              if (isBeforeMutationError(e)) return e
              return new ExecutorGHReleaseError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              })
            }),
          ),
          { after: pushTags[i]! },
        )
      })

      // Return handles for result collection
      return {
        publishes,
        verifyPublishes,
        createTags,
        pushTags,
        createGHReleases,
      }
    },
  })

/**
 * The default, un-gated release workflow (no before-mutation hook). Used by
 * graph rendering and any execution path that does not inject a gate.
 */
export const ReleaseWorkflow = makeReleaseWorkflow()
