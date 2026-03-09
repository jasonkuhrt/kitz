import * as Err from './err.js'
/**
 * Global settings for Kit library type testing utilities.
 *
 * These settings control the behavior of type assertions and can be configured
 * per-project by augmenting the global namespace.
 *
 * @example
 * ```typescript
 * // In your project: types/kit-settings.d.ts
 * declare global {
 *   namespace KITZ {
 *     namespace Ts {
 *       namespace Test {
 *         interface Settings {
 *           lintBidForExactPossibility: true
 *         }
 *       }
 *     }
 *   }
 * }
 * export {}
 * ```
 */

declare global {
  namespace KITZ {
    /**
     * Configuration for type test assertions.
     *
     * Augment this interface in your project to customize behavior.
     * Inherits error rendering settings from {@link KITZ.Ts.Error}.
     */
    interface Assert {
      /**
       * When `true`, using {@link bid} when {@link exact} would work shows a type error.
       *
       * This enforces using the most precise assertion available, helping maintain
       * stronger type guarantees in your tests.
       *
       * **Recommended:** `true` for new projects to enforce best practices.
       *
       * @default false
       *
       * @example
       * ```typescript
       * // With lintBidForExactPossibility: false (default)
       * A.bid<string, string>()('hello')  // ✓ Allowed
       *
       * // With lintBidForExactPossibility: true
       * A.bid<string, string>()('hello')  // ✗ Error: Use exact() instead
       * A.exact<string, string>()('hello') // ✓ Correct
       *
       * // bid() still works when only bidirectional (not exact)
       * A.bid<string & {}, string>()('hello') // ✓ Allowed (not structurally equal)
       * ```
       */
      // todo: rename exact terminology
      lintBidForExactPossibility: boolean

      /**
       * Show detailed diff information in type assertion errors.
       *
       * When enabled, assertion errors include structured diff fields:
       * - `diff_missing__`: Properties in expected but not in actual
       * - `diff_excess___`: Properties in actual but not in expected
       * - `diff_mismatch_`: Properties with different types
       *
       * **When useful:**
       * - Debugging complex type mismatches with many properties
       * - Understanding structural differences between large types
       * - Working with deeply nested object types
       *
       * **When NOT useful:**
       * - Simple primitive type mismatches (e.g., `string` vs `number`)
       * - Very complex types where diff becomes unreadable in IDE hovers
       * - When you want cleaner, more concise error messages
       *
       * **Performance impact:**
       * - Computing diffs uses recursive type operations
       * - Can slow down type checking, especially for large types
       * - Disabled by default for better performance and cleaner errors
       *
       * @default false
       *
       * @example
       * ```typescript
       * // Default behavior (showDiff: false)
       * Assert.exact.ofAs<{ a: 1 }>().onAs<{ a: 2 }>()
       * // Error shows: "EXPECTED only overlaps with ACTUAL"
       * // With tip but no diff fields
       *
       * // Opt-in to detailed diff
       * declare global {
       *   namespace KITZ {
       *     namespace Ts {
       *       interface Assert {
       *         showDiff: true
       *       }
       *     }
       *   }
       * }
       * export {}
       *
       * // Now shows full structured diff:
       * // {
       * //   ERROR: "EXPECTED only overlaps with ACTUAL",
       * //   expected: { a: 1 },
       * //   actual: { a: 2 },
       * //   diff_mismatch_: { a: { expected: 1, actual: 2 } },
       * //   tip: "Types share some values but differ"
       * // }
       * ```
       */
      showDiff: boolean
    }

    /**
     * Global performance settings for Kit library type-level operations.
     *
     * These settings control performance trade-offs for computationally expensive
     * type operations across all modules.
     */
    namespace Perf {
      /**
       * Configuration interface for performance-sensitive type operations.
       *
       * Augment this interface in your project to enable slower but more powerful operations.
       */
      interface Settings {
        /**
         * Allow slow type-level computations that trade compilation performance for flexibility.
         *
         * **When enabled, allows:**
         * - Type-level operations on larger data structures beyond fast-path limits
         * - Each utility documents its specific effective limits (see individual JSDoc)
         * - Examples: `Str.Length` for >20 chars, future: deep object ops, complex tuple transforms
         *
         * **TypeScript Compiler Limits (Universal):**
         * These are hard limits imposed by the TypeScript compiler that affect all recursive type operations:
         * - **Tail recursion depth**: 1000 iterations (TS 4.5+, tail-recursive conditional types only)
         * - **Type instantiation depth**: 500 levels (non-tail-recursive types)
         * - **Instantiation count**: No hard limit, but affects compilation speed
         *
         * **Implementation Strategy:**
         * Kit's slow path implementations use tail-recursive unrolling to maximize effective limits
         * while staying within compiler constraints. Each utility chooses an appropriate unrolling
         * factor (2x, 4x, 8x, etc.) based on its specific use case, resulting in different effective
         * limits per utility
         *
         * **Performance Impact:**
         * - `false` (default): Fast paths only with clear error messages when limits are exceeded
         * - `true`: Enables slow recursive algorithms with longer compilation times
         *   - Fast path (0-20): ~8 instantiations (instant)
         *   - Slow path (21-4000): ~250-1000 instantiations (noticeable compilation delay)
         *
         * **When to enable:**
         * - You need type-level operations on larger data structures
         * - You accept longer compilation times for this flexibility
         * - You're generating types from dynamic content (e.g., parsing string literals)
         *
         * **Recommendation:** Keep `false` unless explicitly needed. Fast paths cover 95%
         * of use cases with zero performance cost.
         *
         * @default false
         *
         * @example
         * ```typescript
         * // With allowSlow: false (default)
         * type L1 = Str.Length<'hello'>  // ✓ 5 (fast path, 8 instantiations)
         * type L2 = Str.Length<'very long string over 20 chars'>  // ✗ Error: Exceeds limit
         *
         * // With allowSlow: true
         * declare global {
         *   namespace KITZ {
         *     namespace Perf {
         *       interface Settings {
         *         allowSlow: true
         *       }
         *     }
         *   }
         * }
         * export {}
         *
         * type L3 = Str.Length<'very long string over 20 chars'>  // ✓ Works (slower compilation)
         * type L4 = Str.Length<'x'.repeat(1000)>  // ✓ ~250 instantiations (near limit)
         * ```
         *
         * @see {@link https://devblogs.microsoft.com/typescript/announcing-typescript-4-5/#tailrec-conditional | TS 4.5 Tail Recursion}
         */
        allowSlow: boolean

        /**
         * Default depth for type simplification operations.
         *
         * Controls how many levels deep {@link Simplify.Auto} will recursively flatten types.
         * Use `-1` for unlimited depth.
         *
         * **When to adjust:**
         * - Deeper nesting in your domain models → increase depth
         * - Slow compilation times → decrease depth
         * - Most projects work well with default
         *
         * @default 10
         *
         * @example
         * ```typescript
         * // With depth: 10 (default)
         * type Result = Simplify.Auto<DeepType>  // Simplifies 10 levels deep
         *
         * // Customize depth
         * declare global {
         *   namespace KITZ {
         *     namespace Perf {
         *       interface Settings {
         *         depth: 5  // Shallower for faster compilation
         *       }
         *     }
         *   }
         * }
         * export {}
         * ```
         */
        depth: Num.Literal
      }
    }

    /**
     * Global settings for type simplification operations.
     *
     * These settings control how {@link Simplify} handles type traversal and flattening.
     */
    namespace Simplify {
      /**
       * Registry of custom type traversals for {@link Simplify}.
       *
       * Extend this interface to register custom container types that should be traversed
       * during type simplification. Each entry defines a pattern to match and an HKT
       * (higher-kinded type) to apply when matched.
       *
       * **Structure:**
       * ```typescript
       * interface Traversables {
       *   [key: string]: {
       *     extends: Pattern    // Type pattern to match against
       *     traverse: HKT      // HKT to apply, receives [$T, $DepthNext, $SeenNext]
       *   }
       * }
       * ```
       *
       * **Use cases:**
       * - Third-party library types (Effect, fp-ts, RxJS, etc.)
       * - Custom container/monad types
       * - Domain-specific wrapper types
       *
       * @example
       * ```typescript
       * // In your project: types/kit-extensions.d.ts
       * import type { Effect } from 'effect'
       * import type { Simplify, Kind } from '@wollybeard/kit'
       *
       * // Define HKT for Effect traversal
       * interface EffectTraverser extends Kind.Kind {
       *   return: this['parameters'] extends [
       *     infer $T,
       *     infer $DN,
       *     infer $SN
       *   ]
       *     ? $T extends Effect.Effect<infer S, infer E, infer R>
       *       ? Effect.Effect<
       *           Simplify.To<$DN, S, $SN>,
       *           Simplify.To<$DN, E, $SN>,
       *           Simplify.To<$DN, R, $SN>
       *         >
       *       : never
       *     : never
       * }
       *
       * // Register Effect traversal
       * declare global {
       *   namespace KITZ {
       *     namespace Simplify {
       *       interface Traversables {
       *         _effect: {
       *           extends: Effect.Effect<any, any, any>
       *           traverse: EffectTraverser
       *         }
       *       }
       *     }
       *   }
       * }
       * export {}
       *
       * // Now Effect types are traversed during simplification
       * type Result = Simplify.All<Effect.Effect<{ a: 1 } & { b: 2 }, never, never>>
       * // Effect.Effect<{ a: 1; b: 2 }, never, never>
       * ```
       */
      interface Traversables {
        // Empty by default - users augment this interface
      }
    }

    namespace Ts {
      /**
       * Registry of types to preserve during type simplification and display.
       *
       * Add properties to this interface to register types that should not be expanded
       * when types are simplified for display (in errors, hover info, etc.).
       * The property names don't matter - all value types will be unioned together.
       *
       * This is a general TypeScript concept used throughout the library, not just for errors.
       *
       * @example
       * ```typescript
       * // In your project: types/kit-settings.d.ts
       * import type { MySpecialClass, AnotherClass } from './my-classes'
       *
       * declare global {
       *   namespace KITZ {
       *     namespace Ts {
       *       interface PreserveTypes {
       *         mySpecial: MySpecialClass
       *         another: AnotherClass
       *       }
       *     }
       *   }
       * }
       * export {}
       * ```
       */
      interface PreserveTypes {
        // Empty by default - users augment this interface
      }

      /**
       * Configuration for TypeScript error rendering.
       *
       * These settings apply to all TS errors (StaticError, StaticErrorAssertion, etc.).
       * Augment this interface in your project to customize behavior.
       */
      interface Error {
        /**
         * Minimum key length for error message alignment.
         *
         * All keys in error messages will be padded with underscores to this length
         * for visual alignment.
         *
         * @default 14
         *
         * @example
         * ```typescript
         * // In your project: types/kit-settings.d.ts
         * declare global {
         *   namespace KITZ {
         *     namespace Ts {
         *       interface Error {
         *         errorKeyLength: 16
         *       }
         *     }
         *   }
         * }
         * export {}
         * ```
         */
        errorKeyLength: 14

        /**
         * Controls how errors are rendered in IDE hovers.
         *
         * - `true`: Show full error object with all fields (ERROR, expected, actual, tip, etc.)
         * - `false`: Show only the error message string for cleaner hovers
         *
         * **Use `true` for debugging** - See all available context about the type mismatch
         * **Use `false` for cleaner UI** - Reduce hover noise when you just need the message
         *
         * @default true
         *
         * @example
         * ```typescript
         * // With renderErrors: true (default)
         * // Hover shows: { ERROR_________: "...", expected______: ..., actual________: ..., tip___________: "..." }
         *
         * // With renderErrors: false
         * // Hover shows: "EXPECTED and ACTUAL are disjoint"
         * ```
         */
        renderErrors: boolean
      }
    }
  }
}

import type { Num } from '#num'
/**
 * Kit's built-in augmentation of PreserveTypes.
 *
 * IMPORTANT: Keep synchronized with {@link Lang.BuiltInTypes}.
 * Any type in BuiltInTypes should have a corresponding entry here.
 *
 * @internal
 */
import type { PrimitiveBrandLike } from './ts.ts'

declare global {
  namespace KITZ {
    namespace Ts {
      interface PreserveTypes {
        // Primitives
        _void: void
        _string: string
        _number: number
        _boolean: boolean
        _symbol: symbol
        _bigint: bigint
        _null: null
        _undefined: undefined
        // Branded primitives - catches ALL Effect branded types by structural matching
        // See {@link PrimitiveBrandLike} for details on how this pattern works
        _branded: PrimitiveBrandLike
        // Non parameterized Object built-ins
        _Function: Function
        _Date: Date
        _Error: Error
        _RegExp: RegExp
        // Assertion errors - preserve exact/actual structure for error messages
        _assertErrors: Err.StaticError<['assert']>
      }
    }
  }
}

/**
 * Helper type to read an error setting with proper defaults.
 *
 * @internal
 */
export type GetErrorSetting<K extends keyof KITZ.Ts.Error> = KITZ.Ts.Error[K]

/**
 * Get the renderErrors setting with proper default handling.
 *
 * - If the setting is exactly `boolean` (not extended to true/false), defaults to `true`
 * - Otherwise uses the extended value
 *
 * @internal
 */
export type GetRenderErrors<$Value = GetErrorSetting<'renderErrors'>> = boolean extends $Value
  ? true
  : $Value

/**
 * Get the showDiff setting with proper default handling.
 *
 * - If the setting is exactly `boolean` (not extended to true/false), defaults to `false`
 * - Otherwise uses the extended value
 *
 * @internal
 */
export type GetShowDiff<$Value = KITZ.Assert['showDiff']> = boolean extends $Value ? false : $Value

/**
 * Extract all preserved types from the Ts.PreserveTypes registry.
 * Returns a union of all value types in the interface.
 * Returns `never` if no types are registered.
 *
 * Used throughout the library for type simplification and display.
 *
 * @internal
 */
// oxfmt-ignore
export type GetPreservedTypes =
  [keyof KITZ.Ts.PreserveTypes] extends [never]
    ? never
    : KITZ.Ts.PreserveTypes[keyof KITZ.Ts.PreserveTypes]
