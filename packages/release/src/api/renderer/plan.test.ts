import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'vitest'
import { makeCascadeCommit } from '../analyzer/models/commit.js'
import { Official } from '../planner/models/item-official.js'
import { Plan } from '../planner/models/plan.js'
import { OfficialFirst } from '../version/models/official-first.js'
import { OfficialIncrement } from '../version/models/official-increment.js'
import { renderApplyConfirmation, renderApplyDone, renderApplyDryRun, renderPlan } from './plan.js'

// ── Helpers ──────────────────────────────────────────────────────────

const pkg = (name: string, scope: string) => ({
  name: Pkg.Moniker.parse(name),
  scope,
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const commit = (scope: string, msg: string) => makeCascadeCommit(scope, msg)

const makeRelease = (
  name: string,
  scope: string,
  from: string,
  to: string,
  bump: Semver.BumpType,
) =>
  Official.make({
    package: pkg(name, scope),
    version: OfficialIncrement.make({
      from: Semver.fromString(from),
      to: Semver.fromString(to),
      bump,
    }),
    commits: [commit(scope, 'test commit')],
  })

const makeFirstRelease = (name: string, scope: string, version: string) =>
  Official.make({
    package: pkg(name, scope),
    version: OfficialFirst.make({ version: Semver.fromString(version) }),
    commits: [commit(scope, 'initial commit')],
  })

// ── renderPlan ───────────────────────────────────────────────────────

describe('renderPlan', () => {
  test('empty plan returns no releases message', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [],
      cascades: [],
    })
    expect(renderPlan(plan)).toBe('No releases planned.')
  })

  test('single release without cascades', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')],
      cascades: [],
    })
    const output = renderPlan(plan)
    expect(output).toContain('Official release plan')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('1.0.0')
    expect(output).toContain('1.1.0')
    expect(output).toContain('minor')
    expect(output).toContain('Releases (1)')
    expect(output).not.toContain('Cascades (')
  })

  test('multiple releases with cascades', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '2.0.0', 'major')],
      cascades: [makeRelease('@kitz/cli', 'cli', '1.0.0', '1.0.1', 'patch')],
    })
    const output = renderPlan(plan)
    expect(output).toContain('Official release plan')
    expect(output).toContain('Releases (1)')
    expect(output).toContain('Cascades (1)')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('@kitz/cli')
    expect(output).toContain('patch')
  })

  test('first release shows "new" instead of current version', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeFirstRelease('@kitz/core', 'core', '0.1.0')],
      cascades: [],
    })
    const output = renderPlan(plan)
    expect(output).toContain('new')
    expect(output).toContain('0.1.0')
  })

  test('shows commit count', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '1.0.1', 'patch')],
      cascades: [],
    })
    const output = renderPlan(plan)
    expect(output).toContain('1')
  })

  test('sorts release rows by commit count descending', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialIncrement.make({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.1.0'),
            bump: 'minor',
          }),
          commits: [commit('core', 'feat(core): first')],
        }),
        Official.make({
          package: pkg('@kitz/cli', 'cli'),
          version: OfficialIncrement.make({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.1.0'),
            bump: 'minor',
          }),
          commits: [
            commit('cli', 'feat(cli): first'),
            commit('cli', 'fix(cli): second'),
            commit('cli', 'fix(cli): third'),
          ],
        }),
      ],
      cascades: [],
    })
    const output = renderPlan(plan)

    expect(output.indexOf('@kitz/cli')).toBeLessThan(output.indexOf('@kitz/core'))
  })
})

// ── renderApplyConfirmation ──────────────────────────────────────────

describe('renderApplyConfirmation', () => {
  test('shows release count and steps', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')],
      cascades: [],
    })
    const output = renderApplyConfirmation(plan)
    expect(output).toContain('1 package to release')
    expect(output).toContain('preflight checks')
    expect(output).toContain('npm')
    expect(output).toContain('git tags')
    expect(output).toContain('--yes')
  })

  test('pluralizes for multiple packages', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor'),
        makeRelease('@kitz/cli', 'cli', '2.0.0', '2.0.1', 'patch'),
      ],
      cascades: [],
    })
    const output = renderApplyConfirmation(plan)
    expect(output).toContain('2 packages to release')
  })
})

// ── renderApplyDryRun ────────────────────────────────────────────────

describe('renderApplyDryRun', () => {
  test('shows DRY RUN prefix and actions', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')],
      cascades: [],
    })
    const output = renderApplyDryRun(plan)
    expect(output).toContain('[DRY RUN]')
    expect(output).toContain('Publish')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('1 git tag')
  })
})

// ── renderApplyDone ──────────────────────────────────────────────────

describe('renderApplyDone', () => {
  test('singular', () => {
    expect(renderApplyDone(1)).toContain('1 package released')
  })

  test('plural', () => {
    expect(renderApplyDone(3)).toContain('3 packages released')
  })
})
