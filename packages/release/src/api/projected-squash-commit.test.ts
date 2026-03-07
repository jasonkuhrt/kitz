import { describe, expect, test } from 'vitest'
import { preview, renderHeader } from './projected-squash-commit.js'

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
})
