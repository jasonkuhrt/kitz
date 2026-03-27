import { Schema as S } from 'effect'

/**
 * Schema for pnpm-workspace.yaml configuration file.
 */
export class Config extends S.Class<Config>('PnpmWorkspaceConfig')({
  /** Glob patterns for workspace packages. */
  packages: S.optional(S.Array(S.String)),
  /** Shared dependency catalog (pnpm 9+). */
  catalog: S.optional(S.Record(S.String, S.String)),
  /** Named catalogs for different dependency sets (pnpm 9+). */
  catalogs: S.optional(S.Record(S.String, S.Record(S.String, S.String))),
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
