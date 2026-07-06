/**
 * Typed POSIX path module.
 *
 * Organizing principle:
 * 1. Unary operations live as instance getters on the four leaf value classes.
 * 2. Shared getter logic lives below the leaves in `core/`.
 * 3. N-ary operations are flat `Fn.dual` functions exported from this barrel.
 * 4. Union classes remain pure schemas plus tagged-union utilities.
 * 5. String interpretation stays at the analyzer boundary.
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

// Extension types and constants
export * as Extension from './models/Extension.js'

// Filename and segment value codecs
export { FileName } from './models/FileName.js'
export { Segment } from './models/segment.js'

// Protocol — URL scheme enum + codec (`file` ⇄ `file://`)
export * as Protocol from './models/Protocol.js'

// Flat path combinators
export * from './operators/addExtension.js'
export * from './operators/ensureAbs.js'
export * from './operators/fromFileUrl.js'
export * from './operators/getSharedBase.js'
export * from './operators/isAncestorOf.js'
export * from './operators/isDescendantOf.js'
export * from './operators/join.js'
export * from './operators/order.js'
export * from './operators/relativeTo.js'
export * from './operators/withExtension.js'
export * from './operators/withName.js'
export * from './operators/withStem.js'

// Optics for composing path updates into larger structures.
export * as Optic from './optic.js'
