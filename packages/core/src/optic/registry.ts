import type * as Array from './lenses/array.js'
import type * as Awaited from './lenses/awaited.js'
import type * as Parameter1 from './lenses/parameter1.js'
import type * as Parameter2 from './lenses/parameter2.js'
import type * as Parameter3 from './lenses/parameter3.js'
import type * as Parameter4 from './lenses/parameter4.js'
import type * as Parameter5 from './lenses/parameter5.js'
import type * as Parameters from './lenses/parameters.js'
import type * as Returned from './lenses/returned.js'

/**
 * Central registry of all type lenses (Get kinds).
 *
 * **This is the single source of truth for lenses.**
 *
 * To add a new lens:
 * 1. Define the lens module in lenses/
 * 2. Add entry here: `lensName: LensModule.$Get`
 * 3. Run `bun run generate:test-namespaces`
 *
 * Everything else (builder API, generated files) derives automatically.
 */
export interface LensRegistry {
  awaited: Awaited.$Get
  returned: Returned.$Get
  array: Array.$Get
  parameters: Parameters.$Get
  parameter1: Parameter1.$Get
  parameter2: Parameter2.$Get
  parameter3: Parameter3.$Get
  parameter4: Parameter4.$Get
  parameter5: Parameter5.$Get
}

/**
 * Get lens Kind by name.
 */
export type GetLens<$Name extends keyof LensRegistry> = LensRegistry[$Name]

/**
 * All registered lens names.
 */
export type LensName = keyof LensRegistry
