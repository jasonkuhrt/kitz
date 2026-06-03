import { Result } from 'effect'
import { facets } from './commit.js'
import { StandardToken } from './footer.js'
import { parseEither } from './title.js'

/**
 * The standard breaking-change footer tokens, sourced from the {@link StandardToken}
 * grammar so this predicate stays in lock-step with the footer definition.
 */
const breakingFooterTokens: readonly string[] = Object.values(StandardToken.enums)

/**
 * Does this freeform text carry a conventional-commit breaking-change signal?
 *
 * Detects every CC breaking-change marker the grammar defines:
 *
 * 1. A **leading `!`** — text whose first non-whitespace character is `!`.
 * 2. A **breaking header** — a leading line that parses as a conventional-commit
 *    title denoting a breaking change (`type!:`, `type(scope)!:`, `type(scope!):`),
 *    decided by the canonical {@link parseEither} grammar rather than an ad-hoc regex.
 * 3. A **standard breaking-change footer** — a line beginning with a
 *    `BREAKING CHANGE:` / `BREAKING-CHANGE:` token.
 *
 * The check is intentionally conservative (it owns the "no breaking content"
 * invariant for consumers like release commit-body overrides): a leading `!` is
 * flagged even though, on its own, it is not strictly a header marker. A `!` or
 * the words "breaking change" appearing mid-line is **not** a signal.
 */
export const hasSignal = (text: string): boolean => {
  const lines = text.split('\n')

  // 3. Standard breaking-change footer token at the start of any line.
  for (const line of lines) {
    const trimmed = line.trimStart()
    if (breakingFooterTokens.some((token) => trimmed.startsWith(`${token}:`))) {
      return true
    }
  }

  // 1. Leading `!` breaking marker.
  if (text.trimStart().startsWith('!')) {
    return true
  }

  // 2. Breaking header on the leading (first non-blank) line.
  const leadingLine = lines.map((line) => line.trim()).find((line) => line.length > 0) ?? ''
  const parsed = parseEither(leadingLine)
  if (Result.isSuccess(parsed) && facets(parsed.success).some((facet) => facet.breaking)) {
    return true
  }

  return false
}
