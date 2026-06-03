import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import { ConventionalCommits } from './_.js'

const { hasSignal } = ConventionalCommits.BreakingChange

// ─── hasSignal ────────────────────────────────────────────────────

// A "signal" is any conventional-commit breaking-change marker per the grammar:
//   1. a leading `!`
//   2. a breaking header (`type!:`, `type(scope)!:`, `type(scope!):`)
//   3. a standard `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer token
Test.on(hasSignal)
  // dprint-ignore
  .cases(
    // No signal — ordinary corrected changelog text.
    [['corrected wording for the parser fix'], false],
    [['add support for nested scopes'], false],
    [[''], false],
    // A `!` mid-text is not a leading marker.
    [['rename a != b helper'], false],
    // Mentioning the words mid-sentence (lowercase, not a footer line) is not a signal.
    [['document the breaking change policy'], false],
    // A non-breaking CC-style header carries no breaking signal.
    [['feat: add a thing'], false],
    [['feat(core): add a thing'], false],
    // Leading `!`.
    [['!important correction'], true],
    [['!'], true],
    // Breaking headers.
    [['feat!: now breaking'], true],
    [['feat(core)!: now breaking'], true],
    [['feat(core!): now breaking'], true],
    // Standard breaking-change footer tokens (on their own line).
    [['reworded summary\n\nBREAKING CHANGE: removed the old API'], true],
    [['reworded summary\n\nBREAKING-CHANGE: removed the old API'], true],
    // Footer token with leading indentation still counts.
    [['reworded\n\n  BREAKING CHANGE: gone'], true],
    // The token mid-line (not at line start) is not a footer.
    [['see the BREAKING CHANGE: note below'], false],
  )
  .test()

describe('BreakingChange.hasSignal — relationship to the grammar', () => {
  test('agrees with Title parsing on breaking headers', () => {
    // Anything the title grammar parses as breaking must be flagged.
    const breakingTitles = ['fix!: x', 'fix(a)!: x', 'feat(a, b)!: x', 'feat(a!): x']
    for (const title of breakingTitles) {
      expect(hasSignal(title)).toBe(true)
    }
  })

  test('does not flag non-breaking parsed headers', () => {
    const nonBreaking = ['fix: x', 'feat(a): x', 'chore(a, b): x']
    for (const title of nonBreaking) {
      expect(hasSignal(title)).toBe(false)
    }
  })
})
