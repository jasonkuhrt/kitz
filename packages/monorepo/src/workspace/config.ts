import { Sch } from '@kitz/sch'
import { Schema as S } from 'effect'

/**
 * Schema for the workspace section in the root package.json manifest.
 *
 * @example
 * ```json
 * {
 *   "workspaces": ["packages/*", "apps/*"]
 * }
 * ```
 */
export class Config extends Sch.Class<Config>()('WorkspaceConfig', {
  /** Glob patterns for workspace packages. */
  packages: S.Array(S.String),
}) {}
