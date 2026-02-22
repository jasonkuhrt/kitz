import { Context } from 'effect'

/** Package info in a monorepo. */
export interface Package {
  /** Package name from package.json. */
  readonly name: string
  /** Relative path from repo root. */
  readonly path: string
}

/** Monorepo data available to lint rules. */
export interface Monorepo {
  /** All packages in the workspace. */
  readonly packages: readonly Package[]
  /** Valid scope names (package names without org prefix). */
  readonly validScopes: readonly string[]
}

/** Service providing monorepo context. */
export class MonorepoService extends Context.Tag('MonorepoService')<MonorepoService, Monorepo>() {}
