import { Schema as S } from 'effect'
import { CascadeImpact } from './cascade-impact.js'
import { Impact } from './impact.js'
import { PackageSchema } from './package-schema.js'

/**
 * The result of analyzing a repository — the expensive analytical core.
 *
 * Computed once by `Analyzer.analyze()`, consumed by both `Planner` (to project
 * concrete version numbers) and `Commentator` (to render PR comment projections).
 */
export class Analysis extends S.TaggedClass<Analysis>()('Analysis', {
  impacts: S.Array(Impact),
  cascades: S.Array(CascadeImpact),
  unchanged: S.Array(PackageSchema),
  tags: S.Array(S.String),
}) {
  static is = S.is(Analysis)
}
