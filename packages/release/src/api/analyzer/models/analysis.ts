import type { Package } from '../workspace.js'
import type { CascadeImpact } from './cascade-impact.js'
import type { Impact } from './impact.js'

/**
 * The result of analyzing a repository — the expensive analytical core.
 *
 * Computed once by `Analyzer.analyze()`, consumed by both `Planner` (to project
 * concrete version numbers) and `Commentator` (to render PR comment projections).
 */
export interface Analysis {
  /** Per-package impact: which packages changed, what bump level, which commits */
  readonly impacts: Impact[]
  /** Packages that need version bumps due to dependency changes */
  readonly cascades: CascadeImpact[]
  /** Packages with no changes */
  readonly unchanged: Package[]
  /** All git tags found (cached to avoid re-querying) */
  readonly tags: string[]
}
