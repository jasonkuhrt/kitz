import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { ReleaseCommit } from '../analyzer/models/commit.js'
import { Official } from '../planner/models/item-official.js'
import { Plan } from '../planner/models/plan.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import { formatLifecycleEvent, toPayload } from './execute.js'

const makePackage = (scope: string) => ({
  scope,
  name: Pkg.Moniker.parse(`@kitz/${scope}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makeRelease = (
  scope: string,
  from: string,
  to: string,
  commits: ReturnType<typeof ReleaseCommit.make>[] = [],
) =>
  Official.make({
    package: makePackage(scope),
    version: OfficialIncrement.make({
      from: Semver.fromString(from),
      to: Semver.fromString(to),
      bump: 'minor',
    }),
    commits,
  })

describe('executor execute helpers', () => {
  test('formats lifecycle events into printable log lines', () => {
    expect(formatLifecycleEvent({ _tag: 'ActivityStarted', activity: 'publish' } as any)).toEqual({
      level: 'info',
      message: '  Starting: publish',
    })
    expect(formatLifecycleEvent({ _tag: 'ActivityCompleted', activity: 'publish' } as any)).toEqual(
      {
        level: 'info',
        message: '✓ Completed: publish',
      },
    )
    expect(
      formatLifecycleEvent({
        _tag: 'ActivityFailed',
        activity: 'publish',
        error: 'boom',
      } as any),
    ).toEqual({
      level: 'error',
      message: '✗ Failed: publish - boom',
    })
    expect(formatLifecycleEvent({ _tag: 'WorkflowStarted' } as any)).toBeUndefined()
  })

  test('builds workflow payloads in dependency order and normalizes commit data', async () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-03-23T00:00:00.000Z',
      releases: [makeRelease('cli', '1.0.0', '1.1.0'), makeRelease('core', '1.0.0', '1.1.0')],
      cascades: [],
    })

    const payload = await Effect.runPromise(
      toPayload(plan, {
        dryRun: true,
        tag: 'next',
        registry: 'https://registry.npmjs.org',
        publishing: {
          official: { mode: 'manual' },
          candidate: { mode: 'manual' },
          ephemeral: { mode: 'manual' },
        },
        trunk: 'main',
      }).pipe(
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/core/package.json': JSON.stringify({
              name: '@kitz/core',
              version: '1.0.0',
            }),
            '/repo/packages/cli/package.json': JSON.stringify({
              name: '@kitz/cli',
              version: '1.0.0',
              dependencies: {
                '@kitz/core': 'workspace:*',
              },
            }),
          }),
        ),
      ),
    )

    expect(payload.releases.map((release) => release.packageName)).toEqual([
      '@kitz/core',
      '@kitz/cli',
    ])
    expect(payload.releases[1]!.dependsOn).toEqual(['@kitz/core'])
    expect(payload.releases[0]!.currentVersion).toEqual(Option.some('1.0.0'))
    expect(payload.options).toEqual({
      dryRun: true,
      tag: 'next',
      registry: 'https://registry.npmjs.org',
      lifecycle: 'official',
      publishing: {
        official: { mode: 'manual' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'manual' },
      },
      trunk: 'main',
    })
  })
})
