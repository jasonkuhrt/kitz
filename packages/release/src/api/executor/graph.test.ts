import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { describe, expect, it as test } from '@effect/vitest'
import { Effect } from 'effect'
import { graph, toJsonGraph } from './execute.js'
import { makeHarness, makePackageJson, planOfficial, tag } from './test-support.js'

const corePackagePath = Fs.Path.AbsDir.fromString('/repo/packages/core/')

const workspacePackages: Parameters<typeof planOfficial>[0] = [
  {
    name: Pkg.Moniker.parse('@kitz/core'),
    scope: 'core',
    path: corePackagePath,
  },
]

const tagCore = (version: string) => tag(Pkg.Moniker.parse('@kitz/core'), version)

describe('Executor graph', () => {
  test.live('builds the release DAG without starting the workflow runtime', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        git: {
          tags: [tagCore('1.0.0')],
          commits: [Git.Memory.commit('feat(core): new API')],
          isClean: true,
        },
        diskLayout: {
          '/repo/packages/core/package.json': makePackageJson('@kitz/core', '1.0.0'),
        },
      })

      const plan = yield* planOfficial(workspacePackages).pipe(Effect.provide(harness.planLayer))
      const result = yield* graph(plan, { dryRun: true }).pipe(Effect.provide(harness.planLayer))

      expect(result.layers.flatMap((layer) => [...layer])).toEqual([
        'Prepare:@kitz/core',
        'Publish:@kitz/core',
        `CreateTag:${tagCore('1.1.0')}`,
        `PushTag:${tagCore('1.1.0')}`,
        `CreateGHRelease:${tagCore('1.1.0')}`,
      ])

      const json = toJsonGraph(result)
      expect(json.nodes['Publish:@kitz/core']).toEqual({
        dependencies: ['Prepare:@kitz/core'],
      })
      expect(json.nodes[`CreateTag:${tagCore('1.1.0')}`]).toEqual({
        dependencies: ['Publish:@kitz/core'],
      })
    }),
  )
})
