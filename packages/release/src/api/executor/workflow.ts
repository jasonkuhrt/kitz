/**
 * @module executor/workflow
 *
 * Declarative DAG definition for the release workflow using @kitz/flo.
 *
 * Graph structure:
 * ```
 * Preflight --> Publish:A --> CreateTag:A --> PushTag:A --> CreateGHRelease:A
 *          |--> Publish:B --> CreateTag:B --> PushTag:B --> CreateGHRelease:B
 *          `--> Publish:C --> CreateTag:C --> PushTag:C --> CreateGHRelease:C
 * ```
 */

import { Flo } from '@kitz/flo'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Schema } from 'effect'
import * as Log from '../log/__.js'
import {
  ExecutorError as ExecutorErrorSchema,
  ExecutorGHReleaseError,
  ExecutorPreflightError,
  ExecutorPublishError,
  ExecutorTagError,
} from './errors.js'
import type { ExecutorError } from './errors.js'
import { type PreflightError, run as runPreflight } from './preflight.js'
import { publishPackage, type ReleaseInfo } from './publish.js'

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
  bump: Schema.UndefinedOr(Schema.Literal('major', 'minor', 'patch')),
  commits: Schema.Array(CommitEntrySchema),
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
  }),
})

export type ReleasePayloadType = Schema.Schema.Type<typeof ReleasePayload>

// ============================================================================
// Activity Helpers
// ============================================================================

/**
 * Convert a workflow release payload to ReleaseInfo for publishing.
 */
export const toReleaseInfo = (
  release: ReleasePayloadType['releases'][number],
): ReleaseInfo => ({
  package: {
    name: Pkg.Moniker.parse(release.packageName),
    path: Fs.Path.AbsDir.fromString(release.packagePath),
    scope: release.packageName.startsWith('@')
      ? release.packageName.split('/')[1]!
      : release.packageName,
  },
  nextVersion: Semver.fromString(release.nextVersion),
})

// ============================================================================
// Workflow Definition (Declarative DAG)
// ============================================================================

/**
 * The main release workflow using declarative DAG execution.
 *
 * - Preflight runs first (if not dry-run)
 * - All Publish activities run concurrently after Preflight
 * - Each CreateTag runs after its corresponding Publish
 * - Each PushTag runs after its corresponding CreateTag
 * - Each CreateGHRelease runs after its corresponding PushTag
 */
export const ReleaseWorkflow = Flo.Workflow.make({
  name: 'ReleaseWorkflow',
  payload: ReleasePayload,
  error: ExecutorErrorSchema,

  graph: (payload, node) => {
    const plannedReleases = payload.releases.map(toReleaseInfo)

    // Layer 0: Preflight checks (skip in dry-run mode)
    const preflight = payload.options.dryRun
      ? null
      : node(
        'Preflight',
        runPreflight(plannedReleases, {
          ...(payload.options.registry && { registry: payload.options.registry }),
        }).pipe(
          Effect.mapError((e: PreflightError) =>
            new ExecutorPreflightError({
              context: {
                check: e.context.check,
                detail: e.message,
              },
            })
          ),
          Effect.asVoid,
        ),
      )

    // Layer 1: Publish each package (concurrent)
    const publishes = payload.releases.map((release) =>
      node(
        `Publish:${release.packageName}`,
        Effect.gen(function*() {
          const releaseInfo = toReleaseInfo(release)

          const tag = formatTag(releaseInfo.package.name, releaseInfo.nextVersion)
          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would publish ${tag}`)
          } else {
            yield* Effect.log(`Publishing ${tag}...`)
            yield* publishPackage(releaseInfo, {
              ...(payload.options.tag && { tag: payload.options.tag }),
              ...(payload.options.registry && { registry: payload.options.registry }),
            })
          }

          return release.packageName
        }).pipe(
          Effect.mapError((e) =>
            new ExecutorPublishError({
              context: {
                packageName: release.packageName,
                detail: e instanceof Error ? e.message : String(e),
              },
            })
          ),
        ),
        {
          ...(preflight && { after: preflight }),
          retry: { times: 2 },
        },
      )
    )

    // Layer 2: Create git tags (each depends on its corresponding publish)
    const createTags = payload.releases.map((release, i) => {
      const tag = formatTag(Pkg.Moniker.parse(release.packageName), Semver.fromString(release.nextVersion))
      return node(
        `CreateTag:${tag}`,
        Effect.gen(function*() {
          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would create tag: ${tag}`)
          } else {
            yield* Effect.log(`Creating tag: ${tag}`)
            const gitService = yield* Git.Git
            yield* gitService.createTag(tag, `Release ${tag}`)
          }
          return tag
        }).pipe(
          Effect.mapError((e) =>
            new ExecutorTagError({
              context: {
                tag,
                detail: e instanceof Error ? e.message : String(e),
              },
            })
          ),
        ),
        { after: publishes[i]! },
      )
    })

    // Layer 3: Push each tag (each depends on its corresponding createTag)
    const pushTags = payload.releases.map((release, i) => {
      const tag = formatTag(Pkg.Moniker.parse(release.packageName), Semver.fromString(release.nextVersion))
      const isPreview = payload.options.tag === 'next' || tag.endsWith('@next')
      return node(
        `PushTag:${tag}`,
        Effect.gen(function*() {
          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would push tag: ${tag}`)
          } else {
            yield* Effect.log(`Pushing tag: ${tag}`)
            const gitService = yield* Git.Git
            yield* gitService.pushTag(tag, 'origin', isPreview)
          }
          return tag
        }).pipe(
          Effect.mapError((e) =>
            new ExecutorTagError({
              context: {
                tag,
                detail: e instanceof Error ? e.message : String(e),
              },
            })
          ),
        ),
        {
          after: createTags[i]!,
          retry: { times: 2 },
        },
      )
    })

    // Layer 4: Create GitHub releases (each depends on its corresponding pushTag)
    const createGHReleases = payload.releases.map((release, i) => {
      const tag = formatTag(Pkg.Moniker.parse(release.packageName), Semver.fromString(release.nextVersion))
      const isPreview = payload.options.tag === 'next' || tag.endsWith('@next')
      return node(
        `CreateGHRelease:${tag}`,
        Effect.gen(function*() {
          if (payload.options.dryRun) {
            yield* Effect.log(`[dry-run] Would create GH release: ${tag}`)
            return tag
          }

          yield* Effect.log(`Creating GH release: ${tag}`)

          // Generate changelog for release body
          const changelog = yield* Log.format({
            scope: release.packageName,
            commits: release.commits,
            newVersion: release.nextVersion,
          })

          const gh = yield* Github.Github

          // Check if preview release already exists
          if (isPreview) {
            const exists = yield* gh.releaseExists(tag)

            if (exists) {
              // Update existing preview release
              yield* Effect.log(`Updating existing preview release: ${tag}`)
              yield* gh.updateRelease(tag, { body: changelog.markdown })
            } else {
              // Create new preview release
              yield* gh.createRelease({
                tag,
                title: `${release.packageName} @next`,
                body: changelog.markdown,
                prerelease: true,
              })
            }
          } else {
            // Create stable release
            yield* gh.createRelease({
              tag,
              title: `${release.packageName} v${release.nextVersion}`,
              body: changelog.markdown,
            })
          }

          return tag
        }).pipe(
          Effect.mapError((e) =>
            new ExecutorGHReleaseError({
              context: {
                tag,
                detail: e instanceof Error ? e.message : String(e),
              },
            })
          ),
        ),
        {
          after: pushTags[i]!,
          retry: { times: 2 },
        },
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
