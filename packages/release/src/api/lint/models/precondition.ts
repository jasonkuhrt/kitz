import { Schema } from 'effect'

/** Current branch has an open pull request. */
export class HasOpenPR extends Schema.TaggedClass<HasOpenPR>()('PreconditionHasOpenPR', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(HasOpenPR)
  static decode = Schema.decodeUnknownEffect(HasOpenPR)
  static decodeSync = Schema.decodeUnknownSync(HasOpenPR)
  static encode = Schema.encodeUnknownEffect(HasOpenPR)
  static encodeSync = Schema.encodeUnknownSync(HasOpenPR)
  static equivalence = Schema.toEquivalence(HasOpenPR)
  static ordered = false as const
}

/** PR has file changes (not an empty PR or missing diff context). */
export class HasDiff extends Schema.TaggedClass<HasDiff>()('PreconditionHasDiff', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(HasDiff)
  static decode = Schema.decodeUnknownEffect(HasDiff)
  static decodeSync = Schema.decodeUnknownSync(HasDiff)
  static encode = Schema.encodeUnknownEffect(HasDiff)
  static encodeSync = Schema.encodeUnknownSync(HasDiff)
  static equivalence = Schema.toEquivalence(HasDiff)
  static ordered = false as const
}

/** Project declares monorepo workspaces in the root package.json. */
export class IsMonorepo extends Schema.TaggedClass<IsMonorepo>()('PreconditionIsMonorepo', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(IsMonorepo)
  static decode = Schema.decodeUnknownEffect(IsMonorepo)
  static decodeSync = Schema.decodeUnknownSync(IsMonorepo)
  static encode = Schema.encodeUnknownEffect(IsMonorepo)
  static encodeSync = Schema.encodeUnknownSync(IsMonorepo)
  static equivalence = Schema.toEquivalence(IsMonorepo)
  static ordered = false as const
}

/** GitHub API token available with repo read access. */
export class HasGitHubAccess extends Schema.TaggedClass<HasGitHubAccess>()(
  'PreconditionHasGitHubAccess',
  {},
) {
  static make = this.makeUnsafe
  static is = Schema.is(HasGitHubAccess)
  static decode = Schema.decodeUnknownEffect(HasGitHubAccess)
  static decodeSync = Schema.decodeUnknownSync(HasGitHubAccess)
  static encode = Schema.encodeUnknownEffect(HasGitHubAccess)
  static encodeSync = Schema.encodeUnknownSync(HasGitHubAccess)
  static equivalence = Schema.toEquivalence(HasGitHubAccess)
  static ordered = false as const
}

/** A release plan is available (computed versions and packages to publish). */
export class HasReleasePlan extends Schema.TaggedClass<HasReleasePlan>()(
  'PreconditionHasReleasePlan',
  {},
) {
  static make = this.makeUnsafe
  static is = Schema.is(HasReleasePlan)
  static decode = Schema.decodeUnknownEffect(HasReleasePlan)
  static decodeSync = Schema.decodeUnknownSync(HasReleasePlan)
  static encode = Schema.encodeUnknownEffect(HasReleasePlan)
  static encodeSync = Schema.encodeUnknownSync(HasReleasePlan)
  static equivalence = Schema.toEquivalence(HasReleasePlan)
  static ordered = false as const
}

/** Runtime applicability check for a lint rule. Not user-configurable. */
export type Precondition = HasOpenPR | HasDiff | IsMonorepo | HasGitHubAccess | HasReleasePlan

export const Precondition = Schema.Union([
  HasOpenPR,
  HasDiff,
  IsMonorepo,
  HasGitHubAccess,
  HasReleasePlan,
]).pipe(Schema.toTaggedUnion('_tag'))

export namespace Precondition {
  export type HasOpenPR = import('./precondition.js').HasOpenPR
  export type HasDiff = import('./precondition.js').HasDiff
  export type IsMonorepo = import('./precondition.js').IsMonorepo
  export type HasGitHubAccess = import('./precondition.js').HasGitHubAccess
  export type HasReleasePlan = import('./precondition.js').HasReleasePlan
}
