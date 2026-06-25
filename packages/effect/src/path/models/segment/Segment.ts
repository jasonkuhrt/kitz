import { Schema as S } from 'effect'
import { Here } from './Here.js'
import { Name } from './Name.js'
import { Up } from './Up.js'

/**
 * `Segment` — one step of a path: a parent traversal (`..`, {@link Up}), a
 * current-dir no-op (`.`, {@link Here}), or a named descent ({@link Name}), as a
 * `string` ⇄ step value codec.
 *
 * Annotated to a compact named codec type so declaration emit references it instead of
 * inlining each member (which overflows — TS7056).
 *
 * @example
 * ```ts
 * S.decodeSync(Segment)('..')   // Up
 * S.decodeSync(Segment)('.')    // Here
 * S.decodeSync(Segment)('src')  // Name { name: 'src' }
 * ```
 */
export const Segment: S.Codec<Up | Here | Name, string, never, never> = S.Union([Up, Here, Name])
export type Segment = typeof Segment.Type
