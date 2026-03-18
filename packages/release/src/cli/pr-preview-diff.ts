import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect, MutableHashSet } from 'effect'
import { PackageLocation } from '../api/analyzer/package-location.js'
import { ExplorerError } from '../api/explorer/errors.js'
import type { ChangedFile, Diff } from '../api/lint/services/diff.js'
import type { Package } from '../api/analyzer/workspace.js'

export interface DiffRemoteConfigLike {
  readonly lint?: {
    readonly rules?: Record<
      string,
      {
        readonly options?: Record<string, unknown>
      }
    >
  }
}

export const resolveDiffRemote = (config: DiffRemoteConfigLike): string => {
  const remote = config.lint?.rules?.['env.git-remote']?.options?.['remote']
  return typeof remote === 'string' && remote.trim().length > 0 ? remote.trim() : 'origin'
}

const parseDiffStatus = (token: string): ChangedFile['status'] => {
  switch (token[0]) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

const parseDiffLine = (line: string): ChangedFile | null => {
  const parts = line.split('\t')
  const statusToken = parts[0]?.trim()
  if (!statusToken) return null

  const path =
    statusToken.startsWith('R') || statusToken.startsWith('C')
      ? (parts[2]?.trim() ?? parts[1]?.trim())
      : parts[1]?.trim()

  if (!path) return null

  return {
    path,
    status: parseDiffStatus(statusToken),
  }
}

const toAffectedPackages = (
  files: readonly ChangedFile[],
  packages: readonly Package[],
  root: Fs.Path.AbsDir,
): readonly string[] => {
  const packageRoots = packages
    .map((pkg) => ({
      scope: pkg.scope,
      location: PackageLocation.fromAbsolutePath(root, pkg.path),
    }))
    .toSorted(
      (left, right) =>
        PackageLocation.toRelativePathString(right.location).length -
        PackageLocation.toRelativePathString(left.location).length,
    )
  const affected = MutableHashSet.empty<string>()

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/gu, '/').replace(/^\.\/+/u, '')

    for (const pkg of packageRoots) {
      if (PackageLocation.containsRepoPath(pkg.location, normalizedPath)) {
        MutableHashSet.add(affected, pkg.scope)
        break
      }
    }
  }

  return Array.from(affected).toSorted((left, right) => left.localeCompare(right))
}

export const loadPullRequestDiff = (params: {
  readonly pullRequest: Github.PullRequest
  readonly packages: readonly Package[]
  readonly required: boolean
  readonly remote?: string
}) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const root = Fs.Path.AbsDir.fromString(yield* git.getRoot())
    const baseRef = params.pullRequest.base.ref.trim()
    const remote = params.remote ?? 'origin'

    if (baseRef.length === 0) {
      return params.required
        ? yield* Effect.fail(
            new ExplorerError({
              context: {
                detail:
                  'Connected pull request is missing a base ref, so release preview cannot compute the PR diff.',
              },
            }),
          )
        : null
    }

    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const command = ChildProcess.make(
      'git',
      ['diff', '--name-status', `${remote}/${baseRef}...HEAD`],
      { cwd: Fs.Path.toString(root) },
    )
    const output = yield* spawner.string(command).pipe(
      Effect.result,
      Effect.flatMap((result) => {
        if (result._tag === 'Success') return Effect.succeed(result.success)

        if (!params.required) {
          return Effect.logWarning(
            `Skipping diff-aware release checks because git diff against ${remote}/${baseRef} could not be computed: ${result.failure instanceof Error ? result.failure.message : JSON.stringify(result.failure)}`,
          ).pipe(Effect.as(''))
        }

        return Effect.fail(
          new ExplorerError({
            context: {
              detail:
                `Could not compute git diff against ${remote}/${baseRef}. ` +
                'Fetch the pull-request base branch before running release preview or doctor.',
            },
          }),
        )
      }),
    )

    const files = output
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map(parseDiffLine)
      .filter((entry: ChangedFile | null): entry is ChangedFile => entry !== null)

    return {
      files,
      affectedPackages: toAffectedPackages(files, params.packages, root),
    }
  })

export const loadConfiguredPullRequestDiff = (params: {
  readonly config: DiffRemoteConfigLike
  readonly pullRequest: Github.PullRequest
  readonly packages: readonly Package[]
  readonly required: boolean
}) =>
  loadPullRequestDiff({
    pullRequest: params.pullRequest,
    packages: params.packages,
    required: params.required,
    remote: resolveDiffRemote(params.config),
  })
