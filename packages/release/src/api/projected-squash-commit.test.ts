import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Impact } from './analyzer/models/impact.js'
import { collectScopeImpacts, preview, renderHeader } from './projected-squash-commit.js'

const makeImpact = (scope: string, bump: 'major' | 'minor' | 'patch') =>
  Impact.make({
    package: {
      scope,
      name: Pkg.Moniker.parse(`@kitz/${scope}`),
      path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
    },
    bump,
    commits: [],
    currentVersion: Option.none(),
  })

describe('projected squash commit', () => {
  test('renders a canonical release header from primary impacts', () => {
    const result = renderHeader({
      impacts: [
        { scope: 'cli', bump: 'patch' },
        { scope: 'core', bump: 'patch' },
        { scope: 'release', bump: 'major' },
      ],
    })

    expect(result).toBe('feat(release)!, fix(cli, core)')
  })

  test('compares the actual PR title header against the projected release header', () => {
    const result = preview({
      actualTitle: 'feat(cli, core)!, feat(release): add @kitz/release package',
      impacts: [
        { scope: 'cli', bump: 'major' },
        { scope: 'core', bump: 'major' },
        { scope: 'release', bump: 'minor' },
      ],
    })

    expect(result.projectedHeader).toBe('feat(cli, core)!, feat(release)')
    expect(result.actualHeader).toBe('feat(cli, core)!, feat(release)')
    expect(result.inSync).toBe(true)
  })

  test('collects unique scope impacts and keeps the highest bump per scope', () => {
    const result = collectScopeImpacts(
      {
        impacts: [
          makeImpact('release', 'patch'),
          makeImpact('cli', 'patch'),
          makeImpact('release', 'minor'),
          makeImpact('cli', 'major'),
          makeImpact('core', 'minor'),
        ],
      },
      { scopes: ['release', 'cli'] },
    )

    expect(result).toEqual([
      { scope: 'cli', bump: 'major' },
      { scope: 'release', bump: 'minor' },
    ])
  })

  test('returns null when there is no projected header to render', () => {
    expect(renderHeader({ impacts: [] })).toBeNull()
  })

  test('returns a reason when there are no primary impacts', () => {
    const result = preview({
      actualTitle: 'feat(release): polish',
      impacts: [],
    })

    expect(result.projectedHeader).toBeNull()
    expect(result.reason).toContain('No primary release impacts')
  })

  test('captures parse errors for invalid current PR titles', () => {
    const result = preview({
      actualTitle: 'bad title',
      impacts: [{ scope: 'release', bump: 'minor' }],
    })

    expect(result.projectedHeader).toBe('feat(release)')
    expect(result.actualHeader).toBeNull()
    expect(result.actualTitleError).toContain('Missing colon separator')
    expect(result.inSync).toBe(false)
  })

  test('treats an empty title as already in sync when there are no impacts', () => {
    const result = preview({
      actualTitle: '   ',
      impacts: [],
    })

    expect(result.actualTitle).toBe('')
    expect(result.projectedHeader).toBeNull()
    expect(result.inSync).toBe(true)
  })
})
