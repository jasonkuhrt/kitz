/**
 * Function composition with support for Extractor metadata preservation.
 *
 * Composes functions right-to-left: `compose(f, g)(x)` = `f(g(x))`.
 * When all inputs are Extractors, preserves `.kind` metadata for type-level composition.
 *
 * @module
 *
 * @example
 * ```ts
 * import { Fn } from '@wollybeard/kit'
 *
 * // Regular function composition
 * const add1 = (x: number) => x + 1
 * const double = (x: number) => x * 2
 * const transform = Fn.compose(add1, double)
 * transform(5) // 11
 *
 * // Extractor composition (preserves .kind)
 * const extract = Fn.compose(awaited, returned)
 * // extract.kind combines both Kinds for type-level composition
 * ```
 */

import type { Extractor } from './extractor.js'
import { isExtractor } from './extractor.js'
import type * as Kind from './kind.js'

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Type-Level Composition
//
//
//

/**
 * Compose two Kinds (type-level functions) right-to-left.
 *
 * @template $K1 - First Kind (applied last)
 * @template $K2 - Second Kind (applied first)
 * @returns Composed Kind that applies $K2 then $K1
 *
 * @example
 * ```ts
 * // type Result = ComposeKind<Awaited$, Returned>
 * // Applies: T -> Returned<T> -> Awaited<Returned<T>>
 * ```
 */
export interface ComposeKind<$K1 extends Kind.Kind, $K2 extends Kind.Kind> extends Kind.Kind {
  return: Kind.Apply<$K1, [Kind.Apply<$K2, [this['parameters']]>]>
}

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Composition
//
//
//

/**
 * Compose two extractors, preserving `.kind` metadata.
 *
 * @param f1 - First extractor (applied last)
 * @param f2 - Second extractor (applied first)
 * @returns Composed extractor with combined Kind
 *
 * @category Composition
 */
// oxfmt-ignore
export function compose<
  f1 extends Extractor,
  f2 extends Extractor
>(
  f1: f1,
  f2: f2
): Extractor<
  Parameters<f2>[0],
  ReturnType<f1>
> & { kind: ComposeKind<f1['kind'], f2['kind']> }

/**
 * Compose two regular functions (no .kind metadata).
 *
 * @param f1 - First function (applied last)
 * @param f2 - Second function (applied first)
 * @returns Composed function
 *
 * @category Composition
 */
// oxfmt-ignore
export function compose<
  f1 extends (x: any) => any,
  f2 extends (x: any) => any
>(
  f1: f1,
  f2: f2
): (x: Parameters<f2>[0]) => ReturnType<f1>

/**
 * Compose multiple functions right-to-left.
 * Functions are applied from right to left (last to first in array).
 *
 * @param fns - Functions to compose
 * @returns Composed function
 *
 * @category Composition
 */
export function compose(...fns: Function[]): Function

// Implementation
export function compose(...fns: Function[]): any {
  if (fns.length === 0) {
    throw new Error('compose requires at least one function')
  }

  if (fns.length === 1) {
    return fns[0]
  }

  // Runtime composition (right to left)
  const composed = (x: any) => fns.reduceRight((acc, fn) => fn(acc), x)

  // If all inputs are Extractors, compose their .kind metadata
  if (fns.every(isExtractor)) {
    const extractors = fns

    // Compose kinds right-to-left (matching function application order)
    const composedKind = extractors.reduce((acc, extractor) => {
      // Each step wraps the accumulated kind in a composition
      return {
        return: undefined, // Placeholder for Kind interface
        _composed: [extractor.kind, acc],
      } as any
    })
    ;(composed as any).kind = composedKind
  }

  return composed
}

/**
 * Compose two functions or extractors (convenience overload).
 * Alias for {@link compose} with exactly 2 arguments.
 *
 * @param f1 - First function (applied last)
 * @param f2 - Second function (applied first)
 * @returns Composed function/extractor
 *
 * @category Composition
 */
export const compose2 = compose as {
  <f1 extends Extractor, f2 extends Extractor>(
    f1: f1,
    f2: f2,
  ): Extractor<Parameters<f2>[0], ReturnType<f1>> & { kind: ComposeKind<f1['kind'], f2['kind']> }

  <f1 extends (x: any) => any, f2 extends (x: any) => any>(
    f1: f1,
    f2: f2,
  ): (x: Parameters<f2>[0]) => ReturnType<f1>
}
