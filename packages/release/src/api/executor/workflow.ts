/**
 * @module executor/workflow
 *
 * Declarative DAG definition for the release workflow using @kitz/flo.
 *
 * Graph structure:
 * ```
 * Prepare:A ---+--> Publish:A --> CreateTag:A --> PushTag:A --> CreateGHRelease:A
 * Prepare:B ---+--> Publish:B --> CreateTag:B --> PushTag:B --> CreateGHRelease:B
 * Prepare:C ---+--> Publish:C --> CreateTag:C --> PushTag:C --> CreateGHRelease:C
 * ```
 */

import { Flo } from '@kitz/flo'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import * as Notes from '../notes/__.js'
import { formatGithubReleaseTitle, Publishing, resolvePublishSemantics } from '../publishing.js'
import { LifecycleSchema } from '../version/models/lifecycle.js'
import {
  ExecutorError as ExecutorErrorSchema,
  ExecutorGHReleaseError,
  ExecutorPublishError,
  ExecutorTagError,
} from './errors.js'
import type { ExecutorError } from './errors.js'
import {
  artifactPathFor,
  preparePackageArtifact,
  publishPreparedArtifact,
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
    lifecycle: Schema.optional(LifecycleSchema),
    publishing: Schema.optional(Publishing),
    trunk: Schema.optional(Schema.String),
  }),
})

export type ReleasePayloadType = typeof ReleasePayload.Type

const releaseWorkflowIdempotencyKey = (payload: ReleasePayloadType): string =>
  JSON.stringify({
    options: {
      dryRun: payload.options.dryRun,
      tag: payload.options.tag ?? null,
      registry: payload.options.registry ?? null,
      lifecycle: payload.options.lifecycle ?? null,
      trunk: payload.options.trunk ?? null,
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

const legacyCandidateSemantics = (distTag: string) =>
  resolvePublishSemantics({
    lifecycle: 'candidate',
    tag: distTag,
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
export const ReleaseWorkflow = Flo.Workflow.make({
  name: 'ReleaseWorkflow',
  payload: ReleasePayload,
  error: ExecutorErrorSchema,
  idempotencyKey: releaseWorkflowIdempotencyKey,
  layerConcurrency: 1,

  graph: (payload, node) => {
    const publishSemantics =
      payload.options.lifecycle !== undefined
        ? resolvePublishSemantics({
            lifecycle: payload.options.lifecycle,
            ...(payload.options.publishing !== undefined
              ? { publishing: payload.options.publishing }
              : {}),
            ...(payload.options.tag !== undefined ? { tag: payload.options.tag } : {}),
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
          } else {
            yield* Effect.log(`Preparing ${tag}...`)
            yield* preparePackageArtifact(releaseInfo, plannedReleases)
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

          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would publish ${tag}`)
          } else {
            const env = yield* Env.Env
            yield* Effect.log(`Publishing ${tag}...`)
            yield* publishPreparedArtifact(
              {
                ...releaseInfo,
                tarball: artifactPathFor(env.cwd, releaseInfo),
              },
              {
                ...(payload.options.tag && { tag: payload.options.tag }),
                ...(payload.options.registry && { registry: payload.options.registry }),
              },
            )
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
        after.length > 0 ? { after } : undefined,
      )

      publishHandles.push({ packageName: release.packageName, handle })
      return handle
    })

    // Layer 2: Create git tags (each depends on its corresponding publish)
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
            yield* gitService.createTag(tag, `Release ${tag}`)
          }
          return tag
        }).pipe(
          Effect.mapError(
            (e) =>
              new ExecutorTagError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              }),
          ),
        ),
        { after: publishes[i]! },
      )
    })

    // Layer 3: Push each tag (each depends on its corresponding createTag)
    const pushTags = payload.releases.map((release, i) => {
      const tag = formatTag(
        Pkg.Moniker.parse(release.packageName),
        Semver.fromString(release.nextVersion),
      )
      return node(
        `PushTag:${tag}`,
        Effect.gen(function* () {
          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would push tag: ${tag}`)
          } else {
            yield* Effect.log(`Pushing tag: ${tag}`)
            const gitService = yield* Git.Git
            yield* gitService.pushTag(
              tag,
              'origin',
              publishSemantics?.forcePushTag ??
                (payload.options.lifecycle === undefined && payload.options.tag === 'next'),
            )
          }
          return tag
        }).pipe(
          Effect.mapError(
            (e) =>
              new ExecutorTagError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              }),
          ),
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
            commits: release.commits,
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
              yield* gh.updateRelease(tag, {
                title: formatGithubReleaseTitle(
                  publishSemantics ?? legacyCandidateSemantics(distTag),
                  {
                    packageName: release.packageName,
                    version: release.nextVersion,
                  },
                ),
                body: changelog.markdown,
              })
            } else {
              yield* gh.createRelease({
                tag,
                title: formatGithubReleaseTitle(
                  publishSemantics ?? legacyCandidateSemantics(distTag),
                  {
                    packageName: release.packageName,
                    version: release.nextVersion,
                  },
                ),
                body: changelog.markdown,
                prerelease: true,
              })
            }
          } else {
            const releaseSemantics =
              publishSemantics ??
              resolvePublishSemantics({
                lifecycle: isPrereleaseVersion ? 'ephemeral' : 'official',
                ...(payload.options.tag !== undefined ? { tag: payload.options.tag } : {}),
              })
            yield* gh.createRelease({
              tag,
              title: formatGithubReleaseTitle(releaseSemantics, {
                packageName: release.packageName,
                version: release.nextVersion,
              }),
              body: changelog.markdown,
              ...(releaseSemantics.prerelease || isPrereleaseVersion ? { prerelease: true } : {}),
            })
          }

          return tag
        }).pipe(
          Effect.mapError(
            (e) =>
              new ExecutorGHReleaseError({
                context: {
                  tag,
                  detail: e instanceof Error ? e.message : String(e),
                },
              }),
          ),
        ),
        { after: pushTags[i]! },
      )
    })

    // Return handles for result collection
    return {
      publishes,
      createTags,
      pushTags,
      createGHReleases,
    }
  },
})
