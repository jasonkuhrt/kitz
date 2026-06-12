import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { describe, expect } from 'bun:test'
import { Test } from '@kitz/test'
import { Effect, Layer } from 'effect'
import { execute, status } from './execute.js'
import { makeHarness, makePackageJson, planOfficial, tag } from './test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const cliPackagePath = Fs.Path.AbsDir.fromString('/repo/packages/cli/')

const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
  {
    name: Pkg.Moniker.parse('@kitz/cli'),
    scope: 'cli',
    path: cliPackagePath,
  },
]

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)
const tagCli = (version: string) => tag(Pkg.Moniker.parse('@kitz/cli'), version)

const makeStatusHarness = (options?: { readonly failPublishPackages?: readonly string[] }) =>
  makeHarness({
    git: {
      tags: [tagCore('1.0.0'), tagCli('1.0.0')],
      commits: [Git.Memory.commit('feat(core): new API')],
      isClean: true,
    },
    diskLayout: {
      '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
      '/repo/packages/cli/package.json': makePackageJson('@kitz/cli', '1.0.0', {
        dependencies: {
          '@kitz/core': 'workspace:^',
        },
      }),
    },
    ...(options?.failPublishPackages ? { failPublishPackages: options.failPublishPackages } : {}),
  })

describe('Executor status', () => {
  Test.live('reports when the active plan has not started yet', () =>
    Effect.gen(function* () {
      const harness = yield* makeStatusHarness()
      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const workflowStatus = yield* status(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
      )

      expect(workflowStatus.state).toBe('not-started')
      expect(workflowStatus.plannedPackages).toEqual(['@kitz/core', '@kitz/cli'])
    }),
  )

  Test.live('reports suspended workflow state and resume guidance after a publish failure', () =>
    Effect.gen(function* () {
      const harness = yield* makeStatusHarness({
        failPublishPackages: ['@kitz/cli'],
      })
      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const firstRun = yield* execute(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
        Effect.result,
      )

      expect(firstRun._tag).toBe('Failure')

      const workflowStatus = yield* status(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
      )

      expect(workflowStatus.state).toBe('suspended')
      if (workflowStatus.state === 'suspended') {
        expect(workflowStatus.detail).toContain('publish failure injected for @kitz/cli')
      }
    }),
  )

  Test.live('reports completed workflow results after a successful release', () =>
    Effect.gen(function* () {
      const harness = yield* makeStatusHarness()
      const workflowContext = yield* Layer.build(harness.workflowLayer)
      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))

      const run = yield* execute(plan, { dryRun: false }).pipe(Effect.provide(workflowContext))
      const workflowStatus = yield* status(plan, { dryRun: false }).pipe(
        Effect.provide(workflowContext),
      )

      expect(workflowStatus.state).toBe('succeeded')
      if (workflowStatus.state === 'succeeded') {
        expect(workflowStatus.summary).toEqual(run)
      }
    }),
  )
})
