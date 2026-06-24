import { Schema as S } from 'effect'
import { Statics } from '../core.js'
import { Here } from './Here.js'
import { Name } from './Name.js'
import { Up } from './Up.js'

/**
 * `Segment` — one step of a path: a parent traversal (`..`, {@link Up}), a
 * current-dir no-op (`.`, {@link Here}), or a named descent ({@link Name}). The
 * binding **is** the `string` ⇄ step codec; its codec statics (`is`, `decodeSync`,
 * `encodeSync`, …) come from {@link Statics.Codec}.
 *
 * @example
 * ```ts
 * Segment.decodeSync('..')   // Up
 * Segment.decodeSync('.')    // Here
 * Segment.decodeSync('src')  // Name { name: 'src' }
 * ```
 */
// Pin the inner union to a compact, named codec type so declaration emit references it
// instead of inlining each member's statics intersection (which overflows — TS7056).
const schema: S.Codec<Up | Here | Name, string, never, never> = S.Union([Up, Here, Name])

class Segment_ extends Statics.Codec(S.asClass(schema)) {
  static Name = Name
  static Up = Up
  static Here = Here

  /** Whether a step is a parent traversal (`..`). */
  static isParent = (segment: Segment): boolean => segment._tag === 'Up'
}

export const Segment = Segment_
export type Segment = typeof Segment_.Type
