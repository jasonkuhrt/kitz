import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import type { PackageLog } from './generate.js'
import { renderMarkdownLogs, toJsonLogs } from './presentation.js'

// ── Helpers ──────────────────────────────────────────────────────────

const makeLog = (
  name: string,
  scope: string,
  bump: Semver.BumpType,
  currentVersion: string | null,
  nextVersion: string,
  markdown: string,
  hasBreaking = false,
): PackageLog => ({
  package: {
    name: Pkg.Moniker.parse(name),
    scope,
    path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
  },
  commits: [],
  bump,
  currentVersion: currentVersion ? Option.some(Semver.fromString(currentVersion)) : Option.none(),
  nextVersion: Semver.fromString(nextVersion),
  changelog: { markdown, hasBreakingChanges: hasBreaking },
})

// ── toJsonLogs ───────────────────────────────────────────────────────

describe('toJsonLogs', () => {
  test('empty array', () => {
    expect(toJsonLogs([])).toEqual([])
  })

  test('converts log to JSON format', () => {
    const logs = [makeLog('@kitz/core', 'core', 'minor', '1.0.0', '1.1.0', '## Changelog')]
    const json = toJsonLogs(logs)
    expect(json).toHaveLength(1)
    expect(json[0]!.package).toBe('@kitz/core')
    expect(json[0]!.currentVersion).toBe('1.0.0')
    expect(json[0]!.nextVersion).toBe('1.1.0')
    expect(json[0]!.bump).toBe('minor')
    expect(json[0]!.changelog).toBe('## Changelog')
    expect(json[0]!.hasBreakingChanges).toBe(false)
  })

  test('null currentVersion for first release', () => {
    const logs = [makeLog('@kitz/core', 'core', 'minor', null, '0.1.0', '## Changelog')]
    const json = toJsonLogs(logs)
    expect(json[0]!.currentVersion).toBeNull()
  })

  test('preserves hasBreakingChanges', () => {
    const logs = [makeLog('@kitz/core', 'core', 'major', '1.0.0', '2.0.0', '## Changelog', true)]
    const json = toJsonLogs(logs)
    expect(json[0]!.hasBreakingChanges).toBe(true)
  })
})

// ── renderMarkdownLogs ───────────────────────────────────────────────

describe('renderMarkdownLogs', () => {
  test('empty array', () => {
    expect(renderMarkdownLogs([])).toBe('')
  })

  test('single log', () => {
    const logs = [
      makeLog(
        '@kitz/core',
        'core',
        'minor',
        '1.0.0',
        '1.1.0',
        '## @kitz/core v1.1.0\n\n### Features',
      ),
    ]
    const result = renderMarkdownLogs(logs)
    expect(result).toContain('## @kitz/core v1.1.0')
    expect(result).toContain('### Features')
  })

  test('multiple logs separated by double newline', () => {
    const logs = [
      makeLog('@kitz/core', 'core', 'minor', '1.0.0', '1.1.0', '## core'),
      makeLog('@kitz/cli', 'cli', 'patch', '2.0.0', '2.0.1', '## cli'),
    ]
    const result = renderMarkdownLogs(logs)
    expect(result).toContain('## core')
    expect(result).toContain('## cli')
    expect(result).toContain('\n\n')
  })
})
