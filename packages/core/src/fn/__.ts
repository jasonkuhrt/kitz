// Force TS to resolve internal paths for consumer type inference discovery
// See: https://github.com/microsoft/TypeScript/issues/61700
import type * as __kind from '@kitz/core/_internal/fn/kind'

/**
 * @internal DO NOT USE - Forces TypeScript to include internal module references
 * in declaration output. Required for consumer type inference.
 * See: https://github.com/microsoft/TypeScript/issues/61700
 */
export type __InternalFnResolution = __kind.Kind

export * from './fn.js'
export * as Kind from './kind.js'
export * from './lazy.js'
