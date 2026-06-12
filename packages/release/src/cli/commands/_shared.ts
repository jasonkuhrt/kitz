/**
 * @module cli/commands/_shared
 *
 * Shared scaffolding for release CLI commands: common flags, common layers,
 * the error-exit combinator, the frozen-plan `--tag` rejection, the
 * ready-workspace guard, and the lifecycle→planner dispatch.
 *
 * Every command file should consume these instead of re-declaring them.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { NpmRegistry } from '@kitz/npm-registry'
import { Resource } from '@kitz/resource'
import { Console, Effect, FileSystem, Layer, Option } from 'effect'
import { Flag } from 'effect/unstable/cli'
import type { Analysis } from '../../api/analyzer/models/__.js'
import type { Package } from '../../api/analyzer/workspace.js'
import type { Lifecycle } from '../../api/version/models/lifecycle.js'
import * as Config from '../../api/config.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Planner from '../../api/planner/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
  type ReadyCommandWorkspace,
} from './command-workspace.js'

// ─── Flags ───────────────────────────────────────────────────────────

/**
 * `--from <path>` — read the release plan from a specific file path.
 * Carries the `-f` alias; use {@link fromFlagNoAlias} where `-f` is taken
 * by `--format`.
 */
export const fromFlag = Flag.string('from').pipe(
  Flag.withAlias('f'),
  Flag.withDescription('Read the release plan from a specific file path'),
  Flag.optional,
)

/** `--from <path>` without the `-f` alias (for commands where `-f` is `--format`). */
export const fromFlagNoAlias = Flag.string('from').pipe(
  Flag.withDescription('Read the release plan from a specific file path'),
  Flag.optional,
)

// ─── Layers ──────────────────────────────────────────────────────────

/** npm CLI over the platform child-process spawner. */
export const NpmCliLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

/** The base environment every release command needs: process env + filesystem. */
export const CommandBaseLayer = Layer.mergeAll(Env.Live, FileSystemLayer)

// ─── Error Exit ──────────────────────────────────────────────────────

/**
 * Print error lines to stderr (one flush) and exit with code 1.
 *
 * The canonical replacement for the `Console.error` + `env.exit(1)` triad.
 */
export const failWith = (...lines: readonly string[]): Effect.Effect<never, never, Env.Env> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    yield* Console.error(lines.join('\n'))
    return env.exit(1)
  })

// ─── Frozen-Plan --tag Rejection ─────────────────────────────────────

const frozenTagMessage = [
  '--tag cannot override a frozen release plan; the plan-bound dist-tag is part of the workflow identity.',
  'Regenerate the plan with the desired publish profile instead.',
] as const

/**
 * Reject `--tag` on plan-bound commands: the frozen plan owns the dist-tag.
 * Exits with code 1 when the flag was provided; no-ops otherwise.
 */
export const rejectFrozenTag = (tag: Option.Option<string>): Effect.Effect<void, never, Env.Env> =>
  Option.isSome(tag) ? failWith(...frozenTagMessage) : Effect.void

// ─── Ready-Workspace Guard ───────────────────────────────────────────

/**
 * Load the command workspace and run `f` only when packages were found.
 * When the workspace is empty, print the canonical "no packages found"
 * message and succeed without running `f`.
 */
export const withReadyWorkspace = <A, E, R>(
  f: (workspace: ReadyCommandWorkspace) => Effect.Effect<A, E, R>,
  options?: Config.LoadOptions,
) =>
  Effect.gen(function* () {
    const workspace = yield* loadCommandWorkspace(options)
    if (!isReadyCommandWorkspace(workspace)) {
      return yield* Console.log(noPackagesFoundMessage)
    }
    return yield* f(workspace)
  })

// ─── Lifecycle → Planner Dispatch ────────────────────────────────────

export type PlannerError =
  | Explorer.ExplorerError
  | Planner.Errors.ReleaseError
  | Git.GitError
  | Git.GitParseError
  | Github.GithubError
  | Github.GithubNotFoundError
  | Github.GithubAuthError
  | Github.GithubRateLimitError
  | Resource.ResourceError

/**
 * The planner for a release lifecycle. Single dispatch point replacing the
 * per-command `switch`/ternary over `Planner.official|candidate|ephemeral`.
 */
export const plannerFor =
  (lifecycle: Lifecycle) =>
  (
    analysis: Analysis,
    ctx: { readonly packages: readonly Package[] },
    options?: Planner.Options,
  ): Effect.Effect<Planner.Plan, PlannerError, Env.Env | FileSystem.FileSystem | Git.Git> => {
    switch (lifecycle) {
      case 'official':
        return Planner.official(analysis, ctx, options)
      case 'candidate':
        return Planner.candidate(analysis, ctx, options)
      case 'ephemeral':
        return Planner.ephemeral(analysis, ctx, options)
    }
  }
