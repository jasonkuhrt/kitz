import { Schema } from 'effect'
import { Type } from './type.js'

/**
 * A release target representing a type-scope-breaking tuple for one package.
 * Used in CommitMulti where each scope can have its own type and breaking indicator.
 */
export class Target extends Schema.TaggedClass<Target>()('Target', {
  /** Commit type */
  type: Type,
  /** Package scope (e.g., "core", "cli") */
  scope: Schema.String,
  /** Whether this target represents a breaking change */
  breaking: Schema.Boolean,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Target)
  static decode = Schema.decodeUnknownEffect(Target)
  static decodeSync = Schema.decodeUnknownSync(Target)
  static encode = Schema.encodeUnknownEffect(Target)
  static encodeSync = Schema.encodeUnknownSync(Target)
  static equivalence = Schema.toEquivalence(Target)
  static ordered = false as const
}
