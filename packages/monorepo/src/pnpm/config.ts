import { Schema as S } from 'effect'

/**
 * Schema for pnpm-workspace.yaml configuration file.
 *
 * @example
 * ```yaml
 * packages:
 *   - "packages/*"
 *   - "apps/*"
 * catalog:
 *   react: "^18.0.0"
 * ```
 */
export class Config extends S.Class<Config>('PnpmWorkspaceConfig')({
  /** Glob patterns for workspace packages */
  packages: S.optional(S.Array(S.String)),
  /** Shared dependency catalog (pnpm 9+) */
  catalog: S.optional(S.Record({ key: S.String, value: S.String })),
  /** Named catalogs for different dependency sets (pnpm 9+) */
  catalogs: S.optional(S.Record({
    key: S.String,
    value: S.Record({ key: S.String, value: S.String }),
  })),
}) {}
