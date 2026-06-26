import { Option, SchemaIssue } from 'effect'
import type { PathError } from '../analyzer.js'

/**
 * Adapt a {@link PathError} to the `SchemaIssue` that a codec decode getter must
 * fail with (the Schema parser channel only accepts `SchemaIssue.Issue`).
 */
export const toIssue = (error: PathError): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(error.input), { message: error.message })
