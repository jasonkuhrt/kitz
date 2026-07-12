/**
 * Zero-width space (U+200B) \u2014 an unrendered character: invisible in editors,
 * terminals, and compiler diagnostics.
 */
export const ZeroWidthSpace = '\u200B'

/** Type-level twin of {@link ZeroWidthSpace}. */
export type ZeroWidthSpace = typeof ZeroWidthSpace
