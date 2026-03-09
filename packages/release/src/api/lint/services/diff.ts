import { Context, Layer } from 'effect'

/** Changed file info. */
export interface ChangedFile {
  /** File path relative to repo root. */
  readonly path: string
  /** Change type. */
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed'
}

/** Diff data available to lint rules. */
export interface Diff {
  /** List of changed files. */
  readonly files: readonly ChangedFile[]
  /** Affected package names (for monorepos). */
  readonly affectedPackages: readonly string[]
}

/** Service providing diff context. */
export class DiffService extends Context.Tag('DiffService')<DiffService, Diff>() {}

/** Safe default diff context for runs where diff-dependent rules are skipped. */
export const DefaultDiffLayer = Layer.succeed(DiffService, {
  files: [],
  affectedPackages: [],
} satisfies Diff)
