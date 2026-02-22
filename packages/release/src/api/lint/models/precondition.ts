import { Schema } from 'effect'

/** Current branch has an open pull request. */
export class HasOpenPR extends Schema.TaggedClass<HasOpenPR>()('PreconditionHasOpenPR', {}) {
  static is = Schema.is(HasOpenPR)
}

/** PR has file changes (not an empty PR or missing diff context). */
export class HasDiff extends Schema.TaggedClass<HasDiff>()('PreconditionHasDiff', {}) {
  static is = Schema.is(HasDiff)
}

/** Project is a pnpm workspace. */
export class IsMonorepo extends Schema.TaggedClass<IsMonorepo>()('PreconditionIsMonorepo', {}) {
  static is = Schema.is(IsMonorepo)
}

/** GitHub API token available with repo read access. */
export class HasGitHubAccess extends Schema.TaggedClass<HasGitHubAccess>()('PreconditionHasGitHubAccess', {}) {
  static is = Schema.is(HasGitHubAccess)
}

/** A release plan is available (computed versions and packages to publish). */
export class HasReleasePlan extends Schema.TaggedClass<HasReleasePlan>()('PreconditionHasReleasePlan', {}) {
  static is = Schema.is(HasReleasePlan)
}

/** Runtime applicability check for a lint rule. Not user-configurable. */
export type Precondition = HasOpenPR | HasDiff | IsMonorepo | HasGitHubAccess | HasReleasePlan

export const Precondition = Schema.Union(HasOpenPR, HasDiff, IsMonorepo, HasGitHubAccess, HasReleasePlan)
