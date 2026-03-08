/**
 * @module executor/runtime
 *
 * Effect layer composition for workflow execution.
 * Shared runtime composition stays platform-neutral.
 */

import {
  ClusterWorkflowEngine,
  ShardingConfig as ClusterShardingConfig,
  SingleRunner,
} from '@effect/cluster'
import { SqliteClient } from '#platform:executor/sqlite-client'
import { WorkflowEngine } from '@effect/workflow'
import { Github } from '@kitz/github'
import { Effect, Layer } from 'effect'

/**
 * Default database path for workflow state.
 */
export const DEFAULT_DB = '.release/workflow.db'

/**
 * Configuration for the workflow runtime.
 */
export interface RuntimeConfig {
  /** Path to SQLite database file */
  readonly dbPath?: string
  /** Optional sharding overrides for faster local/testing runners */
  readonly shardingConfig?: Partial<ClusterShardingConfig.ShardingConfig['Type']>
  /** GitHub configuration for release creation */
  readonly github?: {
    readonly owner: string
    readonly repo: string
    readonly token?: string
  }
}

/**
 * Create the durable workflow engine layer with SQLite-backed state.
 */
export const makeWorkflowRuntime = (
  config: Pick<RuntimeConfig, 'dbPath' | 'shardingConfig'> = {},
) =>
  ClusterWorkflowEngine.layer.pipe(
    Layer.provide(
      SingleRunner.layer({
        runnerStorage: 'sql',
        ...(config.shardingConfig && { shardingConfig: config.shardingConfig }),
      }),
    ),
    Layer.provideMerge(SqliteClient.layer({ filename: config.dbPath ?? DEFAULT_DB })),
  )

const makeGithubRuntime = (github?: RuntimeConfig['github']) =>
  github
    ? Github.LiveFetch(github)
    : Layer.succeed(Github.Github, {
        releaseExists: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'releaseExists',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        createRelease: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'createRelease',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        updateRelease: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'updateRelease',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        listOpenPullRequests: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'listOpenPullRequests',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        updatePullRequest: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'updatePullRequest',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        listIssueComments: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'listIssueComments',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        findIssueCommentByMarker: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'listIssueComments',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        createIssueComment: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'createIssueComment',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        updateIssueComment: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'updateIssueComment',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        upsertIssueComment: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'createIssueComment',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
      })

/**
 * Create the shared workflow runtime layers.
 *
 * Filesystem and other platform services stay abstract and must be provided
 * by the runtime boundary that executes the workflow.
 */
export const makeRuntime = (config: RuntimeConfig = {}) =>
  Layer.mergeAll(
    makeWorkflowRuntime({
      ...(config.dbPath && { dbPath: config.dbPath }),
      ...(config.shardingConfig && { shardingConfig: config.shardingConfig }),
    }),
    makeGithubRuntime(config.github),
  )

/**
 * Create a test-friendly workflow runtime using in-memory engine.
 *
 * Provides both WorkflowEngine and a mock WorkflowInstance for testing
 * activities without going through the full workflow execution flow.
 */
export const makeTestRuntime = () => WorkflowEngine.layerMemory
