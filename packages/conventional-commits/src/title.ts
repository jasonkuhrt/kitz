import { Effect } from 'effect'
import type { ParseTitleError } from './parse/title.js'
import { parse, parseEither } from './parse/title.js'

export { ParseTitleError, type ParsedTitle, parse, parseEither } from './parse/title.js'

/**
 * Rewrite only the conventional-commit header, preserving the parsed subject.
 *
 * The input title must already be a valid conventional-commit title.
 */
export const rewriteHeader = (
  title: string,
  nextHeader: string,
): Effect.Effect<string, ParseTitleError> =>
  parse(title).pipe(Effect.map((parsed) => `${nextHeader}: ${parsed.message}`))
