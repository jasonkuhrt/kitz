import { Str } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { makeCascadeCommit } from '../analyzer/models/commit.js'
import { Candidate as CandidateItem } from '../planner/models/item-candidate.js'
import { Official } from '../planner/models/item-official.js'
import { Plan } from '../planner/models/plan.js'
import { resolvePublishSemantics } from '../publishing.js'
import { Candidate as CandidateVersion } from '../version/models/candidate.js'
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

const makeFirstRelease = (
  name: string,
  scope: string,
  version: string,
  bump: Semver.BumpType = 'minor',
) =>
  Official.make({
    package: pkg(name, scope),
    version: OfficialFirst.make({ version: Semver.fromString(version), bump }),
    commits: [commit(scope, 'initial commit')],
  })

const officialSemantics = resolvePublishSemantics({ lifecycle: 'official' })
const candidateSemantics = resolvePublishSemantics({ lifecycle: 'candidate' })
const makeOfficialPlan = (releases: Official[] = [], cascades: Official[] = []) =>
  Plan.make({
    lifecycle: 'official',
    timestamp: '2026-01-01T00:00:00Z',
    releases,
    cascades,
  })

// ── renderPlan ───────────────────────────────────────────────────────

describe('renderPlan', () => {
  test('empty plan returns no releases message', () => {
    expect(renderPlan(makeOfficialPlan())).toBe('No releases planned.')
  })

  test('single release without cascades', () => {
    const output = renderPlan(
      makeOfficialPlan([makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')]),
    )
    expect(output).toContain('Official release plan')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('1.0.0')
    expect(output).toContain('1.1.0')
    expect(output).toContain('minor')
    expect(output).toContain('Releases (1)')
    expect(output).not.toContain('Cascades (')
  })

  test('multiple releases with cascades', () => {
    const output = renderPlan(
      makeOfficialPlan(
        [makeRelease('@kitz/core', 'core', '1.0.0', '2.0.0', 'major')],
        [makeRelease('@kitz/cli', 'cli', '1.0.0', '1.0.1', 'patch')],
      ),
    )
    expect(output).toContain('Official release plan')
    expect(output).toContain('Releases (1)')
    expect(output).toContain('Cascades (1)')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('@kitz/cli')
    expect(output).toContain('patch')
  })

  test('first release shows "new" instead of current version', () => {
    const output = renderPlan(
      makeOfficialPlan([makeFirstRelease('@kitz/core', 'core', '0.0.1', 'patch')]),
    )
    expect(output).toContain('new')
    expect(output).toContain('0.0.1')
    expect(output).toContain('patch')
  })

  test('shows commit count in the Commits column', () => {
    // 7 commits: a count that cannot collide with any version digit in the row.
    const output = renderPlan(
      makeOfficialPlan([
        Official.make({
          package: pkg('@kitz/core', 'core'),
          version: OfficialIncrement.make({
            from: Semver.fromString('1.0.0'),
            to: Semver.fromString('1.0.1'),
            bump: 'patch',
          }),
          commits: Array.from({ length: 7 }, (_, index) => commit('core', `commit ${index}`)),
        }),
      ]),
    )

    expect(output).toContain('Commits')
    const row = output.split('\n').find((line) => line.includes('@kitz/core'))
    expect(row?.trimEnd().endsWith('7')).toBe(true)
  })

  test('sorts release rows by commit count descending', () => {
    const output = renderPlan(
      makeOfficialPlan([
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
      ]),
    )

    expect(output.indexOf('@kitz/cli')).toBeLessThan(output.indexOf('@kitz/core'))
  })

  test('sorts cascade rows alphabetically', () => {
    const output = renderPlan(
      makeOfficialPlan(
        [],
        [
          makeRelease('@kitz/zeta', 'zeta', '1.0.0', '1.0.1', 'patch'),
          makeRelease('@kitz/alpha', 'alpha', '1.0.0', '1.0.1', 'patch'),
        ],
      ),
    )

    expect(output.indexOf('@kitz/alpha')).toBeLessThan(output.indexOf('@kitz/zeta'))
  })
})

// ── renderApplyConfirmation ──────────────────────────────────────────

describe('renderApplyConfirmation', () => {
  test('shows release count and steps', () => {
    const plan = makeOfficialPlan([makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')])
    const output = renderApplyConfirmation(plan, officialSemantics)
    expect(output).toContain('1 package to release')
    expect(output).toContain('npm dist-tag: `latest`')
    expect(output).toContain('preflight checks')
    expect(output).toContain('Prepare publishable tarballs')
    expect(output).toContain('npm')
    expect(output).toContain('GitHub releases')
    expect(output).toContain('@kitz/core v1.1.0')
    expect(output).toContain('release preview')
    expect(output).toContain('release prove')
    expect(output).toContain('release rehearse')
  })

  test('pluralizes for multiple packages', () => {
    const plan = makeOfficialPlan([
      makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor'),
      makeRelease('@kitz/cli', 'cli', '2.0.0', '2.0.1', 'patch'),
    ])
    const output = renderApplyConfirmation(plan, officialSemantics)
    expect(output).toContain('2 packages to release')
  })

  test('supports ansi-colored confirmation output', () => {
    const plan = makeOfficialPlan([makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')])
    const output = renderApplyConfirmation(plan, officialSemantics, { color: true })

    expect(output).toContain('\u001b[')
    expect(Str.Visual.strip(output)).toContain('npm dist-tag: `latest`')
  })

  test('uses the resolved release command for command guidance', () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')],
      cascades: [],
    })
    const output = renderApplyConfirmation(plan, officialSemantics, {
      releaseCommand: 'bun run ship',
    })

    expect(output).toContain('bun run ship preview')
    expect(output).toContain('bun run ship prove')
    expect(output).toContain('bun run ship rehearse')
  })

  test('renders cascade entries in confirmation output', () => {
    const plan = makeOfficialPlan([], [makeRelease('@kitz/cli', 'cli', '2.0.0', '2.0.1', 'patch')])
    const output = renderApplyConfirmation(plan, officialSemantics)

    expect(output).toContain('(cascade)')
  })
})

// ── renderApplyDryRun ────────────────────────────────────────────────

describe('renderApplyDryRun', () => {
  test('shows DRY RUN prefix and actions', () => {
    const plan = makeOfficialPlan([makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')])
    const output = renderApplyDryRun(plan, officialSemantics)
    expect(output).toContain('[DRY RUN]')
    expect(output).toContain('Would execute official release plan')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('npm `latest`')
    expect(output).toContain('GitHub `@kitz/core v1.1.0`')
  })

  test('uses dist-tagged GitHub release titles for candidate plans', () => {
    const plan = Plan.make({
      lifecycle: 'candidate',
      timestamp: '2026-01-01T00:00:00Z',
      releases: [
        CandidateItem.make({
          package: pkg('@kitz/core', 'core'),
          baseVersion: Semver.fromString('1.1.0'),
          prerelease: CandidateVersion.make({ iteration: 1 }),
          commits: [commit('core', 'feat(core): candidate')],
        }),
      ],
      cascades: [],
    })

    const output = renderApplyDryRun(plan, candidateSemantics)
    expect(output).toContain('npm `next`')
    expect(output).toContain('GitHub `@kitz/core @next`')
  })

  test('supports ansi-colored dry-run and completion output', () => {
    const plan = makeOfficialPlan([makeRelease('@kitz/core', 'core', '1.0.0', '1.1.0', 'minor')])

    const dryRun = renderApplyDryRun(plan, officialSemantics, { color: true })
    const done = renderApplyDone(1, { color: true })

    expect(dryRun).toContain('\u001b[')
    expect(done).toContain('\u001b[')
    expect(Str.Visual.strip(dryRun)).toContain('Would execute official release plan')
    expect(Str.Visual.strip(done)).toContain('1 package released')
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
