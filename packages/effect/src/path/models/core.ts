import { Option, Schema as S, SchemaIssue } from 'effect'
import type { PathError } from '../analyzer.js'

/**
 * A relative path's parent-traversal count — the number of leading `..` steps.
 * A non-negative integer; absolute paths can't go up so they don't carry it.
 */
export const Back = S.Number.pipe(
  S.check(
    S.makeFilter((n) => Number.isInteger(n) && n >= 0, {
      message: 'back must be a non-negative integer',
    }),
  ),
)
export type Back = typeof Back.Type

/**
 * Adapt a {@link PathError} to the `SchemaIssue` that a codec decode getter must
 * fail with (the Schema parser channel only accepts `SchemaIssue.Issue`).
 */
export const toIssue = (error: PathError): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(error.input), { message: error.message })
