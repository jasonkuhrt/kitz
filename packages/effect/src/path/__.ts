/**
 * Typed POSIX path module.
 *
 * Organizing principle:
 * 1. Unary operations live as instance getters on the four leaf value classes.
 * 2. Variant-local component writes live as model statics.
 * 3. Shared getter/write logic lives below the leaves in `core/`.
 * 4. Cross-variant n-ary operations are flat `Fn.dual` functions exported from this barrel.
 * 5. Union classes remain pure schemas plus tagged-union utilities.
 * 6. String interpretation stays at the analyzer boundary.
 *
 * See `docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md`.
 */

// Union schemas with string codec baked in
export * from './models/Abs.js'
export * from './models/Dir.js'
export * from './models/File.js'
export * from './models/Rel.js'

// Individual member schemas with string codec baked in.
// Explicit re-exports keep the internal `_`-suffixed schema classes (exported from
// each model file only so declaration emit can name them by reference) out of the
// public surface.
export { AbsDir } from './models/AbsDir.js'
export { AbsFile } from './models/AbsFile.js'
export { RelDir } from './models/RelDir.js'
export { RelFile } from './models/RelFile.js'

// Top-level union schema of all path variants (surfaces as `Path.Any`)
export { Any } from './models/Any.js'

// Constants
export * from './constants.js'

// Analyzer — public parse/validate/format of path strings (surfaces as `Path.Analyzer`)
export * as Analyzer from './analyzer.js'

// Literal string analysis and decoding
export type { FromLiteral, LiteralAnalysis } from './core/literal.js'
export * from './operations/fromLiteral.js'

// Extension types and constants
export * as Extension from './models/Extension.js'

// Filename and segment value codecs
export { FileName } from './models/FileName.js'
export { Segment, segment } from './models/segment.js'

// Protocol — URL scheme enum + codec (`file` ⇄ `file://`)
export * as Protocol from './models/Protocol.js'

// Flat path combinators
export * from './operations/ensureAbs.js'
export * from './operations/fromFileUrl.js'
export * from './operations/getSharedBase.js'
export * from './operations/isAncestorOf.js'
export * from './operations/isDescendantOf.js'
export * from './operations/join.js'
export * from './operations/order.js'
export * from './operations/relativeTo.js'
export * from './operations/withName.js'
