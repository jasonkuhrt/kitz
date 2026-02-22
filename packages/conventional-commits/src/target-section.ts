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
}) {}
