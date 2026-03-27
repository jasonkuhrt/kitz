import { Schema } from 'effect'
import { Footer } from './footer.js'

/**
 * A per-package section in a CommitMulti body.
 * Contains the body text and any footers (like BREAKING CHANGE) for that package.
 */
export class TargetSection extends Schema.TaggedClass<TargetSection>()('TargetSection', {
  /** Section body text */
  body: Schema.String,
  /** Footers within this section (including BREAKING CHANGE) */
  footers: Schema.Array(Footer),
}) {
  static make = this.makeUnsafe
  static is = Schema.is(TargetSection)
  static decode = Schema.decodeUnknownEffect(TargetSection)
  static decodeSync = Schema.decodeUnknownSync(TargetSection)
  static encode = Schema.encodeUnknownEffect(TargetSection)
  static encodeSync = Schema.encodeUnknownSync(TargetSection)
  static equivalence = Schema.toEquivalence(TargetSection)
  static ordered = false as const
}
