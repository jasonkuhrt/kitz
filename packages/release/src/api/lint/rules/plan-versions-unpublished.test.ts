import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Effect, Layer, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { ReleasePlan } from '../services/__.js'
import { rule } from './plan-versions-unpublished.js'

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

const makeSpawnerLayer = (exists: boolean) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      const standard = ChildProcess.isStandardCommand(command) ? command : undefined
      if (
        !standard ||
        standard.command !== 'npm' ||
        standard.args?.[0] !== '--silent' ||
        standard.args?.[1] !== 'view'
      ) {
        return Effect.die(
          `Unexpected command in mock spawner: ${standard?.command ?? 'unknown'}`,
        ) as any
      }

      const spec = standard.args?.[2]
      if (spec !== '@kitz/core@1.0.1') {
        return Effect.die(`Unexpected npm view spec: ${spec ?? 'unknown'}`) as any
      }

      return Effect.succeed(
        exists
          ? makeHandle('"1.0.1"\n', 0)
          : makeHandle(
              JSON.stringify(
                {
                  error: {
                    code: 'E404',
                    summary: 'No match found for version 1.0.1',
                  },
                },
                null,
                2,
              ) + '\n',
              1,
            ),
      )
    }),
  )

const releasePlanLayer = ReleasePlan.make([
  {
    packageName: Pkg.Moniker.parse('@kitz/core'),
    packagePath: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
    version: Semver.fromString('1.0.1'),
  },
])

describe('plan.versions-unpublished', () => {
  test('violates when the planned package version already exists on npm', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(releasePlanLayer),
        Effect.provide(makeSpawnerLayer(true)),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    expect(Violation.is(result) ? result.summary : undefined).toContain('@kitz/core@1.0.1')
  })

  test('passes when the planned package version is still unpublished', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(releasePlanLayer),
        Effect.provide(makeSpawnerLayer(false)),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(Violation.is(result)).toBe(false)
    if (Violation.is(result) || result === undefined || !('metadata' in result)) {
      throw new Error('expected rule metadata')
    }

    expect(result.metadata).toEqual({ packageCount: 1 })
  })
})
