// Force TS to resolve internal paths for consumer type inference discovery
// See: https://github.com/microsoft/TypeScript/issues/61700
import type * as __err from '@kitz/core/_internal/ts/err'
import type * as __inhabitance from '@kitz/core/_internal/ts/inhabitance'
import type * as __simpleSignature from '@kitz/core/_internal/ts/simple-signature'
import type * as __simplify from '@kitz/core/_internal/ts/simplify'
import type * as __union from '@kitz/core/_internal/ts/union'
import type * as __variancePhantom from '@kitz/core/_internal/ts/variance-phantom'

/**
 * @internal DO NOT USE - Forces TypeScript to include internal module references
 * in declaration output. Required for consumer type inference.
 * See: https://github.com/microsoft/TypeScript/issues/61700
 */
export type __InternalTsResolution =
  | __err.StaticError
  | __simplify.Top<never>
  | __simpleSignature.GetSignature<never>
  | __inhabitance.IsNever<never>
  | __union.ToTuple<never>
  | __variancePhantom.Co<never>

export * from './ts.js'

export * from './traits/display.js'

// @ts-expect-error Duplicate identifier
export * as SimpleSignature from './simple-signature.js'
/**
 * Utilities for working with the `__simpleSignature` phantom type pattern.
 * Allows complex generic functions to provide simpler signatures for type inference.
 *
 * @category SimpleSignature
 */
export namespace SimpleSignature {}

// @ts-expect-error Duplicate identifier
export * as Inhabitance from './inhabitance.js'
/**
 * Type utilities for classifying types by their inhabitance in TypeScript's type lattice.
 *
 * @category Type Inhabitance
 */
export namespace Inhabitance {}

export * from './ts.js'
export * from './type-guards.js'

// @ts-expect-error Duplicate identifier
export * as Simplify from './simplify.js'
/**
 * Type simplification utilities for flattening and expanding types.
 * All functions automatically preserve globally registered types from {@link KITZ.Ts.PreserveTypes}.
 *
 * @category Type Simplification
 */
export namespace Simplify {}

// @ts-expect-error Duplicate identifier
export * as Err from './err.js'
/**
 * Error utilities for working with static type-level errors.
 *
 * @category Error Utilities
 */
export namespace Err {}

// @ts-expect-error Duplicate identifier
export * as Union from './union.js'
/**
 * Utilities for working with union types at the type level.
 *
 * @category Union Types
 */
export namespace Union {}

// @ts-expect-error Duplicate identifier
export * as VariancePhantom from './variance-phantom.js'
/**
 * Phantom type helpers for controlling type variance (covariance, contravariance, invariance, bivariance).
 *
 * @category Variance
 */
export namespace VariancePhantom {}

export * as Settings from './global-settings.js'
