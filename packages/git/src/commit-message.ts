/**
 * Raw git commit-message helpers.
 *
 * A commit message file (`COMMIT_EDITMSG`, or the path passed to a `commit-msg`
 * hook) is plain text: a subject line, an optional body, and — for editor or
 * template commits — `#` comment lines that git strips after the hook runs.
 * These helpers read that format without taking a dependency on a full parser.
 *
 * @module
 */

/**
 * Extract the subject line from a raw git commit message.
 *
 * Skips leading blank lines and `#` comment lines (git's default comment
 * character), so it behaves the same for `-m` messages and for editor/template
 * messages whose user text follows commented guidance. Returns `null` when the
 * message has no subject (empty, whitespace-only, or comments-only).
 */
export const subject = (raw: string): string | null => {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    return trimmed
  }
  return null
}
