import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import type { Package } from '../api/analyzer/workspace.js'
import {
  loadConfiguredPullRequestDiff,
  loadPullRequestDiff,
  resolveDiffRemote,
} from './pr-preview-diff.js'

const textEncoder = new TextEncoder()

const makeHandle = (stdout: string, exitCode: number): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stderr: Stream.empty,
    stdin: Effect.void as any,
    stdout: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    all: stdout.length > 0 ? Stream.fromIterable([textEncoder.encode(stdout)]) : Stream.empty,
    getInputFd: () => Effect.void as any,
    getOutputFd: () => Stream.empty,
  })

const makeSpawnerLayer = (run: (command: ChildProcess.StandardCommand) => string) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      const standard = ChildProcess.isStandardCommand(command) ? command : undefined
      if (!standard) {
        return Effect.die('Unexpected piped command in mock spawner') as any
      }

      return Effect.succeed(makeHandle(run(standard), 0))
    }),
  )

describe('pr preview diff analysis', () => {
  test('uses configured env.git-remote options for diff-aware checks', () => {
    expect(
      resolveDiffRemote({
        lint: {
          rules: {
            'env.git-remote': {
              options: {
                remote: 'upstream',
              },
            },
          },
        },
      }),
    ).toBe('upstream')
  })

  test('prefers an explicit remote override over configured env.git-remote options', () => {
    expect(
      resolveDiffRemote(
        {
          lint: {
            rules: {
              'env.git-remote': {
                options: {
                  remote: 'upstream',
                },
              },
            },
          },
        },
        'fork',
      ),
    ).toBe('fork')
  })

  test('maps affected packages using the resolved package path', async () => {
    const pullRequest = {
      number: 129,
      html_url: 'https://github.com/org/repo/pull/129',
      title: 'feat(core): update package path matching',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/path-aware-preview' },
    } satisfies Github.PullRequest

    const packages = [
      {
        scope: 'core',
        name: Pkg.Moniker.parse('@kitz/core'),
        path: Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
      },
    ] satisfies readonly Package[]

    const { layer: gitLayer } = await Effect.runPromise(
      Git.Memory.makeWithState({
        root: '/repo',
      }),
    )

    const diff = await Effect.runPromise(
      loadPullRequestDiff({
        pullRequest,
        packages,
        required: true,
      }).pipe(
        Effect.provide(gitLayer),
        Effect.provide(
          makeSpawnerLayer((command) => {
            expect(command.command).toBe('git')
            expect(command.args).toEqual(['diff', '--name-status', 'origin/main...HEAD'])
            return 'M\ttooling/pkg-core/src/index.ts\n'
          }),
        ),
      ),
    )

    expect(diff).toEqual({
      files: [{ path: 'tooling/pkg-core/src/index.ts', status: 'modified' }],
      affectedPackages: ['core'],
    })
  })

  test('loads pull request diffs against the configured remote', async () => {
    const pullRequest = {
      number: 129,
      html_url: 'https://github.com/org/repo/pull/129',
      title: 'feat(core): update package path matching',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/path-aware-preview' },
    } satisfies Github.PullRequest

    const packages = [
      {
        scope: 'core',
        name: Pkg.Moniker.parse('@kitz/core'),
        path: Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
      },
    ] satisfies readonly Package[]

    const { layer: gitLayer } = await Effect.runPromise(
      Git.Memory.makeWithState({
        root: '/repo',
      }),
    )

    const diff = await Effect.runPromise(
      loadConfiguredPullRequestDiff({
        config: {
          lint: {
            rules: {
              'env.git-remote': {
                options: {
                  remote: 'upstream',
                },
              },
            },
          },
        },
        pullRequest,
        packages,
        required: true,
      }).pipe(
        Effect.provide(gitLayer),
        Effect.provide(
          makeSpawnerLayer((command) => {
            expect(command.command).toBe('git')
            expect(command.args).toEqual(['diff', '--name-status', 'upstream/main...HEAD'])
            return 'M\ttooling/pkg-core/src/index.ts\n'
          }),
        ),
      ),
    )

    expect(diff).toEqual({
      files: [{ path: 'tooling/pkg-core/src/index.ts', status: 'modified' }],
      affectedPackages: ['core'],
    })
  })

  test('loads pull request diffs against an explicit remote override', async () => {
    const pullRequest = {
      number: 129,
      html_url: 'https://github.com/org/repo/pull/129',
      title: 'feat(core): update package path matching',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/path-aware-preview' },
    } satisfies Github.PullRequest

    const packages = [
      {
        scope: 'core',
        name: Pkg.Moniker.parse('@kitz/core'),
        path: Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
      },
    ] satisfies readonly Package[]

    const { layer: gitLayer } = await Effect.runPromise(
      Git.Memory.makeWithState({
        root: '/repo',
      }),
    )

    const diff = await Effect.runPromise(
      loadConfiguredPullRequestDiff({
        config: {
          lint: {
            rules: {
              'env.git-remote': {
                options: {
                  remote: 'upstream',
                },
              },
            },
          },
        },
        remote: 'fork',
        pullRequest,
        packages,
        required: true,
      }).pipe(
        Effect.provide(gitLayer),
        Effect.provide(
          makeSpawnerLayer((command) => {
            expect(command.command).toBe('git')
            expect(command.args).toEqual(['diff', '--name-status', 'fork/main...HEAD'])
            return 'M\ttooling/pkg-core/src/index.ts\n'
          }),
        ),
      ),
    )

    expect(diff).toEqual({
      files: [{ path: 'tooling/pkg-core/src/index.ts', status: 'modified' }],
      affectedPackages: ['core'],
    })
  })
})
