/**
 * @module workflow
 *
 * Durable workflow implementation for release operations using @kitz/flo.
 *
 * This module provides resumable, persistent execution for the release process:
 * - Preflight checks
 * - Package publishing (concurrent, with version injection/restoration)
 * - Git tag creation (concurrent, each after its package publishes)
 * - Tag pushing (after all tags created)
 *
 * Uses SQLite for durability, allowing resume from partial failures.
 * The declarative DAG structure enables concurrent execution where dependencies allow.
 */

import { SingleRunner } from '@effect/cluster'
import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { SqliteClient } from '@effect/sql-sqlite-node'
import { Workflow as EffectWorkflow, WorkflowEngine } from '@effect/workflow'
import { Flo } from '@kitz/flo'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer, Match, Option, Schema, Stream } from 'effect'
import * as Log from './log/__.js'
import type { Item, Plan } from './plan/models/__.js'
import { type PreflightError, run as runPreflight } from './preflight.js'
import { publishPackage, type ReleaseInfo } from './publish.js'

/** Format a release tag from package name and version. */
const formatTag = (name: Pkg.Moniker.Moniker, version: Semver.Semver): string =>
  Pkg.Pin.toString(Pkg.Pin.Exact.make({ name, version }))

// ============================================================================
// Error Schemas
// ============================================================================

export {
  ReleaseWorkflowError,
  WorkflowGHReleaseError,
  WorkflowPreflightError,
  WorkflowPublishError,
  WorkflowTagError,
} from './workflow-errors.js'
import type { ReleaseWorkflowError } from './workflow-errors.js'
import {
  ReleaseWorkflowError as ReleaseWorkflowErrorSchema,
  WorkflowGHReleaseError,
  WorkflowPreflightError,
  WorkflowPublishError,
  WorkflowTagError,
} from './workflow-errors.js'

// ============================================================================
// Payload Schema
// ============================================================================

/**
 * Schema for a structured commit entry.
 */
const CommitEntrySchema = Schema.Struct({
  type: Schema.String,
  message: Schema.String,
  hash: Git.Sha.Sha,
  breaking: Schema.Boolean,
})

/**
 * Schema for a single release in the payload.
 */
const ReleaseSchema = Schema.Struct({
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
const ReleasePayload = Schema.Struct({
  releases: Schema.Array(ReleaseSchema),
  options: Schema.Struct({
    dryRun: Schema.Boolean,
    tag: Schema.optional(Schema.String),
    registry: Schema.optional(Schema.String),
  }),
})

type ReleasePayloadType = Schema.Schema.Type<typeof ReleasePayload>

// ============================================================================
// Activity Helpers
// ============================================================================

/**
 * Convert a workflow release payload to ReleaseInfo for publishing.
 */
const toReleaseInfo = (
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
 * Result type for the workflow.
 */
interface WorkflowResult {
  releasedPackages: string[]
  createdTags: string[]
  createdGHReleases: string[]
}

/**
 * The main release workflow using declarative DAG execution.
 *
 * Graph structure:
 * ```
 * Preflight ─┬─→ Publish:A ─→ CreateTag:A ─→ PushTag:A ─→ CreateGHRelease:A
 *            ├─→ Publish:B ─→ CreateTag:B ─→ PushTag:B ─→ CreateGHRelease:B
 *            └─→ Publish:C ─→ CreateTag:C ─→ PushTag:C ─→ CreateGHRelease:C
 * ```
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
  error: ReleaseWorkflowErrorSchema,

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
            new WorkflowPreflightError({
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
            new WorkflowPublishError({
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
            new WorkflowTagError({
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
            new WorkflowTagError({
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
            new WorkflowGHReleaseError({
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

// ============================================================================
// GitHub URL Parsing
// ============================================================================

/**
 * Parse GitHub owner and repo from a git remote URL.
 *
 * Supports both HTTPS and SSH formats:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - github.com/owner/repo
 */
export const parseGithubRemote = (
  url: string,
): { owner: string; repo: string } | null => {
  // Match patterns like:
  // github.com/owner/repo or github.com:owner/repo (with optional .git suffix)
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]! }
}

// ============================================================================
// Layer Composition
// ============================================================================

/**
 * Default database path for workflow state.
 */
export const DEFAULT_WORKFLOW_DB = '.release/workflow.db'

/**
 * Configuration for the workflow runtime.
 */
export interface WorkflowRuntimeConfig {
  /** Path to SQLite database file */
  readonly dbPath?: string
  /** GitHub configuration for release creation */
  readonly github?: {
    readonly owner: string
    readonly repo: string
    readonly token?: string
  }
}

/**
 * Create the full workflow runtime layer with SQLite persistence.
 *
 * @param config - Runtime configuration
 */
export const makeWorkflowRuntime = (config: WorkflowRuntimeConfig = {}) =>
  Layer.mergeAll(
    SqliteClient.layer({ filename: config.dbPath ?? DEFAULT_WORKFLOW_DB }),
    NodeFileSystem.layer,
    NodePath.layer,
    WorkflowEngine.layerMemory,
    config.github
      ? Github.LiveFetch(config.github)
      : Layer.succeed(Github.Github, {
        // Stub implementation when no github config provided
        releaseExists: () => Effect.succeed(false),
        createRelease: () => Effect.die('GitHub not configured'),
        updateRelease: () => Effect.die('GitHub not configured'),
      }),
  ).pipe(
    Layer.provideMerge(SingleRunner.layer({ runnerStorage: 'sql' })),
  )

/**
 * A minimal workflow definition for test mocking.
 */
const TestWorkflowDef = EffectWorkflow.make({
  name: 'TestWorkflow',
  payload: Schema.Struct({ id: Schema.String }),
  idempotencyKey: (payload) => payload.id,
  success: Schema.Void,
})

/**
 * Create a test-friendly workflow runtime using in-memory engine.
 *
 * Provides both WorkflowEngine and a mock WorkflowInstance for testing
 * activities without going through the full workflow execution flow.
 */
export const makeTestWorkflowRuntime = () =>
  Layer.mergeAll(
    WorkflowEngine.layerMemory,
    Layer.succeed(
      WorkflowEngine.WorkflowInstance,
      WorkflowEngine.WorkflowInstance.initial(TestWorkflowDef, 'test-execution-id'),
    ),
  )

// ============================================================================
// Execution API
// ============================================================================

/**
 * Convert a Plan to workflow payload.
 */
export const toWorkflowPayload = (
  plan: Plan,
  options: { dryRun?: boolean; tag?: string; registry?: string } = {},
): ReleasePayloadType => ({
  releases: [...plan.releases, ...plan.cascades].map((r) => ({
    packageName: r.package.name.moniker,
    packagePath: Fs.Path.toString(r.package.path),
    currentVersion: r.currentVersion.pipe(Option.map((v) => v.toString())),
    nextVersion: r.nextVersion.toString(),
    bump: r.bumpType,
    commits: r.commits.map((c) => {
      const info = c.forScope(r.package.scope)
      return {
        type: info.type,
        message: info.description,
        hash: info.hash,
        breaking: info.breaking,
      }
    }),
  })),
  options: {
    dryRun: options.dryRun ?? false,
    ...(options.tag && { tag: options.tag }),
    ...(options.registry && { registry: options.registry }),
  },
})

/**
 * Execute the release workflow.
 *
 * The workflow is durable - if it fails partway through, calling execute
 * again with the same payload will resume from where it left off.
 *
 * Activities execute concurrently where dependencies allow:
 * - All package publishes run in parallel
 * - Each tag creation runs after its package publishes
 * - Each tag push runs after its tag is created
 * - Each GitHub release runs after its tag is pushed
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   executeWorkflow(plan, { dryRun: false }).pipe(
 *     Effect.provide(makeWorkflowRuntime()),
 *     Effect.provide(GitLive),
 *   )
 * )
 * ```
 */
export const executeWorkflow = (
  plan: Plan,
  options: { dryRun?: boolean; tag?: string; registry?: string } = {},
) =>
  Effect.gen(function*() {
    const payload = toWorkflowPayload(plan, options)

    yield* Effect.log(`Starting release workflow for ${payload.releases.length} packages...`)

    const result = yield* ReleaseWorkflow.execute(payload)

    // Extract results from NodeHandle unwrapping
    const releasedPackages = result.publishes as string[]
    const createdTags = result.createTags as string[]
    const createdGHReleases = result.createGHReleases as string[]

    yield* Effect.log(`Workflow complete: ${releasedPackages.length} packages released`)

    return {
      releasedPackages,
      createdTags,
      createdGHReleases,
    } satisfies WorkflowResult
  })

/**
 * Result of observable workflow execution.
 */
export interface ObservableWorkflowResult {
  /** Stream of activity lifecycle events */
  readonly events: Stream.Stream<Flo.LifecycleEvent>
  /** Effect that executes the workflow and returns the result (runtime layer pre-provided) */
  readonly execute: Effect.Effect<WorkflowResult, ReleaseWorkflowError>
  /** Graph information for visualization */
  readonly graph: {
    readonly layers: readonly (readonly string[])[]
    readonly nodes: ReadonlyMap<string, { dependencies: readonly string[] }>
  }
}

export interface LifecycleEventLine {
  readonly level: 'info' | 'error'
  readonly message: string
}

/**
 * Convert workflow lifecycle events to printable log lines.
 */
export const formatLifecycleEvent = (event: Flo.LifecycleEvent): LifecycleEventLine | undefined =>
  Match.value(event).pipe(
    Match.tags({
      ActivityStarted: (e): LifecycleEventLine => ({ level: 'info', message: `  Starting: ${e.activity}` }),
      ActivityCompleted: (e): LifecycleEventLine => ({ level: 'info', message: `✓ Completed: ${e.activity}` }),
      ActivityFailed: (e): LifecycleEventLine => ({ level: 'error', message: `✗ Failed: ${e.activity} - ${e.error}` }),
    }),
    Match.orElse(() => undefined),
  )

/**
 * Execute the release workflow with observable events and graph info.
 *
 * Returns a Stream of activity events, the execution Effect, and graph structure
 * for visualization. The stream emits events as activities start, complete, or fail.
 *
 * **Concurrent execution**: Activities in the same layer run in parallel.
 * Use `graph.layers` to show the execution structure in the UI.
 *
 * **Resume handling**: When resuming from a checkpoint, already-completed
 * activities emit events with very short `durationMs` values.
 *
 * @example
 * ```ts
 * const { events, execute, graph } = yield* executeWorkflowObservable(plan)
 *
 * // Create renderer from graph
 * const renderer = Flo.TerminalRenderer.make({
 *   mode: 'dag',
 *   layers: graph.layers,
 * })
 *
 * // Fork event consumer
 * const eventFiber = yield* events.pipe(
 *   Stream.tap((e) => Effect.sync(() => {
 *     renderer.update(e)
 *     console.clear()
 *     console.log(renderer.render())
 *   })),
 *   Stream.runDrain,
 *   Effect.fork,
 * )
 *
 * // Run workflow
 * const result = yield* execute
 *
 * // Wait for events to flush
 * yield* Fiber.join(eventFiber)
 * ```
 */
export const executeWorkflowObservable = (
  plan: Plan,
  options: { dryRun?: boolean; tag?: string; registry?: string; dbPath?: string } = {},
): Effect.Effect<ObservableWorkflowResult, never, never> =>
  Effect.gen(function*() {
    const payload = toWorkflowPayload(plan, options)

    // Get graph structure for visualization
    const { layers, nodes } = ReleaseWorkflow.toGraph(payload)
    const typedNodes = nodes as ReadonlyMap<string, { dependencies: readonly string[] }>

    // Build edges for renderer
    const graphInfo = {
      layers,
      nodes: new Map(typedNodes.entries()),
    }

    // Get observable execution
    const { events, execute: workflowExecute } = yield* ReleaseWorkflow.observable(payload)

    // Wrap execute to extract results and provide workflow runtime
    const execute = workflowExecute.pipe(
      Effect.map((result: { publishes: string[]; createTags: string[]; createGHReleases: string[] }) => ({
        releasedPackages: result.publishes as string[],
        createdTags: result.createTags as string[],
        createdGHReleases: result.createGHReleases as string[],
      })),
      Effect.provide(makeWorkflowRuntime(options.dbPath ? { dbPath: options.dbPath } : {})),
    ) as Effect.Effect<WorkflowResult, ReleaseWorkflowError>

    return {
      events,
      execute,
      graph: graphInfo,
    }
  })
