import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { makeCascadeCommit } from '../../analyzer/models/commit.js'
import { OfficialFirst } from '../../version/models/official-first.js'
import { OfficialIncrement } from '../../version/models/official-increment.js'
import { Official } from './item-official.js'
import { Plan } from './plan.js'

const pkg = (name: string, scope: string) => ({
  name: Pkg.Moniker.parse(name),
  scope,
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const commit = (scope: string) => makeCascadeCommit(scope, 'test commit')

describe('Plan', () => {
  test('Plan.empty', () => {
    const plan = Plan.empty
    expect(Plan.is(plan)).toBe(true)
    expect(plan.releases).toHaveLength(0)
    expect(plan.cascades).toHaveLength(0)
    expect(plan.lifecycle).toBe('official')
  })

  test('make with releases', () => {
    const plan = new Plan({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        new Official({
          package: pkg('@kitz/core', 'core'),
          version: new OfficialFirst({ version: Semver.fromString('0.1.0') }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })
    expect(plan.releases).toHaveLength(1)
    expect(plan.lifecycle).toBe('official')
  })

  test('make with cascades', () => {
    const plan = new Plan({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [],
      cascades: [
        new Official({
          package: pkg('@kitz/cli', 'cli'),
          version: new OfficialIncrement({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.0.1'),
            bump: 'patch',
          }),
          commits: [commit('cli')],
        }),
      ],
    })
    expect(plan.cascades).toHaveLength(1)
  })

  test('lifecycle variants', () => {
    for (const lifecycle of ['official', 'candidate', 'ephemeral'] as const) {
      const plan = new Plan({
        lifecycle,
        timestamp: '2026-01-01T00:00:00Z',
        releases: [],
        cascades: [],
      })
      expect(plan.lifecycle).toBe(lifecycle)
    }
  })

  test('schema roundtrip with official releases', () => {
    const plan = new Plan({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        new Official({
          package: pkg('@kitz/core', 'core'),
          version: new OfficialIncrement({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.1.0'),
            bump: 'minor',
          }),
          commits: [commit('core')],
        }),
      ],
      cascades: [],
    })

    const encoded = Schema.encodeSync(Plan)(plan)
    const decoded = Schema.decodeSync(Plan)(encoded)
    expect(decoded.releases).toHaveLength(1)
    expect(decoded.lifecycle).toBe('official')
  })
})
