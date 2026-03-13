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
export class Config extends S.Class<Config>('WorkspaceConfig')({
  /** Glob patterns for workspace packages. */
  packages: S.Array(S.String),
}) {
  static make = this.makeUnsafe
}
