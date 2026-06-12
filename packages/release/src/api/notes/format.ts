/**
 * Release note formatting utilities.
 *
 * Pure formatters that convert structured commit data to markdown.
 */

import { ConventionalCommits } from '@kitz/conventional-commits'

/**
 * A commit entry for release note generation.
 */
export interface CommitEntry {
  readonly type: ConventionalCommits.Type.Type
  readonly message: string
  readonly hash: string
  readonly breaking: boolean
}

/**
 * Options for formatting release notes.
 */
export interface FormatOptions {
  /** The package scope (e.g., "@kitz/core") */
  readonly scope: string
  /** Commits to include in the changelog */
  readonly commits: readonly CommitEntry[]
  /** Previous version (for comparison link) */
  readonly previousVersion?: string | undefined
  /** New version being released */
  readonly newVersion: string
}

/**
 * Formatted release note content.
 */
export interface FormattedNotes {
  readonly markdown: string
  readonly hasBreakingChanges: boolean
}

/**
 * Changelog sections in render order. Each commit lands in the FIRST section
 * whose predicate matches (ordered consumption), so breaking commits never
 * repeat under their type's section and `Other Changes` is the remainder.
 */
const sections: ReadonlyArray<readonly [title: string, matches: (commit: CommitEntry) => boolean]> =
  [
    ['Breaking Changes', (commit) => commit.breaking],
    ['Features', (commit) => commit.type.value === 'feat'],
    ['Bug Fixes', (commit) => commit.type.value === 'fix'],
    ['Performance', (commit) => commit.type.value === 'perf'],
    ['Documentation', (commit) => commit.type.value === 'docs'],
    ['Other Changes', () => true],
  ]

/**
 * Format commits into markdown release notes.
 *
 * @example
 * ```ts
 * const notes = format({
 *   scope: '@kitz/core',
 *   commits: [{ type: ConventionalCommits.Type.parse('feat'), message: 'add new API', hash: 'abc123', breaking: false }],
 *   newVersion: '1.0.0',
 * })
 * ```
 */
export const format = (options: FormatOptions): FormattedNotes => {
  const { scope, commits, newVersion } = options

  const buckets = sections.map((): CommitEntry[] => [])
  for (const commit of commits) {
    buckets[sections.findIndex(([, matches]) => matches(commit))]!.push(commit)
  }

  const lines: string[] = [`## ${scope} v${newVersion}`, '']

  sections.forEach(([title], index) => {
    const bucket = buckets[index]!
    if (bucket.length === 0) return

    lines.push(`### ${title}`, '')
    for (const commit of bucket) {
      lines.push(`- ${commit.message} (${commit.hash.slice(0, 7)})`)
    }
    lines.push('')
  })

  return {
    markdown: lines.join('\n'),
    hasBreakingChanges: buckets[0]!.length > 0,
  }
}
