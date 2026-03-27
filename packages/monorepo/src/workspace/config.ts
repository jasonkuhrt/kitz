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
  static is = S.is(Config)
  static decode = S.decodeUnknownEffect(Config)
  static decodeSync = S.decodeUnknownSync(Config)
  static encode = S.encodeUnknownEffect(Config)
  static encodeSync = S.encodeUnknownSync(Config)
  static equivalence = S.toEquivalence(Config)
  static ordered = false as const
}
