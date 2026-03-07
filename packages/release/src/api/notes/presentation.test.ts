import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import type { PackageNotes } from './generate.js'
import { renderMarkdownNotes, toJsonNotes } from './presentation.js'

// ── Helpers ──────────────────────────────────────────────────────────

const makeNotes = (
  name: string,
  scope: string,
  bump: Semver.BumpType,
  currentVersion: string | null,
  nextVersion: string,
  markdown: string,
  hasBreaking = false,
): PackageNotes => ({
  package: {
    name: Pkg.Moniker.parse(name),
    scope,
    path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
  },
  commits: [],
  bump,
  currentVersion: currentVersion ? Option.some(Semver.fromString(currentVersion)) : Option.none(),
  nextVersion: Semver.fromString(nextVersion),
  notes: { markdown, hasBreakingChanges: hasBreaking },
})

// ── toJsonNotes ──────────────────────────────────────────────────────

describe('toJsonNotes', () => {
  test('empty array', () => {
    expect(toJsonNotes([])).toEqual([])
  })

  test('converts notes to JSON format', () => {
    const notes = [makeNotes('@kitz/core', 'core', 'minor', '1.0.0', '1.1.0', '## Notes')]
    const json = toJsonNotes(notes)
    expect(json).toHaveLength(1)
    expect(json[0]!.package).toBe('@kitz/core')
    expect(json[0]!.currentVersion).toBe('1.0.0')
    expect(json[0]!.nextVersion).toBe('1.1.0')
    expect(json[0]!.bump).toBe('minor')
    expect(json[0]!.notes).toBe('## Notes')
    expect(json[0]!.hasBreakingChanges).toBe(false)
  })

  test('null currentVersion for first release', () => {
    const notes = [makeNotes('@kitz/core', 'core', 'minor', null, '0.1.0', '## Notes')]
    const json = toJsonNotes(notes)
    expect(json[0]!.currentVersion).toBeNull()
  })

  test('preserves hasBreakingChanges', () => {
    const notes = [makeNotes('@kitz/core', 'core', 'major', '1.0.0', '2.0.0', '## Notes', true)]
    const json = toJsonNotes(notes)
    expect(json[0]!.hasBreakingChanges).toBe(true)
  })
})

// ── renderMarkdownNotes ──────────────────────────────────────────────

describe('renderMarkdownNotes', () => {
  test('empty array', () => {
    expect(renderMarkdownNotes([])).toBe('')
  })

  test('single notes block', () => {
    const notes = [
      makeNotes(
        '@kitz/core',
        'core',
        'minor',
        '1.0.0',
        '1.1.0',
        '## @kitz/core v1.1.0\n\n### Features',
      ),
    ]
    const result = renderMarkdownNotes(notes)
    expect(result).toContain('## @kitz/core v1.1.0')
    expect(result).toContain('### Features')
  })

  test('multiple notes blocks separated by double newline', () => {
    const notes = [
      makeNotes('@kitz/core', 'core', 'minor', '1.0.0', '1.1.0', '## core'),
      makeNotes('@kitz/cli', 'cli', 'patch', '2.0.0', '2.0.1', '## cli'),
    ]
    const result = renderMarkdownNotes(notes)
    expect(result).toContain('## core')
    expect(result).toContain('## cli')
    expect(result).toContain('\n\n')
  })
})
