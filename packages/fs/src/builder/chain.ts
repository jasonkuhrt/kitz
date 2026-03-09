import { Error as PlatformError, FileSystem } from '@effect/platform'
import type { Json } from '@kitz/json'
import { Effect } from 'effect'
import type { InferFileContent } from '../filesystem.js'
import { Path } from '../path/_.js'
import type { Builder } from './builder.js'
import * as Ops from './operations.js'
import type { Operation, SpecBuilder } from './spec.js'
import * as Spec from './spec.js'

// Re-export Operation for backward compatibility
export type { Operation } from './spec.js'

type FSError = PlatformError.PlatformError
type FS = FileSystem.FileSystem

/**
 * A chainable builder for directory operations.
 * Extends DirSpec with the ability to commit operations.
 */
export interface DirChain extends SpecBuilder {
  // Override return types to return DirChain instead of DirSpec
  file<path extends Path.RelFile | string>(
    path: Path.Guard.RelFile<path>,
    content: path extends Path.RelFile
      ? InferFileContent<path>
      : path extends string
        ? string | Uint8Array | Json.Object
        : never,
  ): DirChain

  dir<path extends Path.RelDir | string>(
    path: Path.Guard.RelDir<path>,
    builder?: (_: DirChain) => DirChain,
  ): DirChain

  when(condition: boolean, builder: (_: DirChain) => DirChain): DirChain

  unless(condition: boolean, builder: (_: DirChain) => DirChain): DirChain

  remove<path extends Path.$Rel | string>(path: Path.Guard.Rel<path>): DirChain

  clear<path extends Path.RelDir | string>(path: Path.Guard.RelDir<path>): DirChain

  move<from extends Path.RelFile | string, to extends Path.RelFile | string>(
    from: Path.Guard.RelFile<from>,
    to: Path.Guard.RelFile<to>,
  ): DirChain

  move<from extends Path.RelDir | string, to extends Path.RelDir | string>(
    from: Path.Guard.RelDir<from>,
    to: Path.Guard.RelDir<to>,
  ): DirChain

  add<path extends Path.RelFile | string>(
    path: Path.Guard.RelFile<path>,
    content: path extends Path.RelFile
      ? InferFileContent<path>
      : path extends string
        ? string | Uint8Array | Json.Object
        : never,
  ): DirChain

  add<path extends Path.RelDir | string>(
    path: Path.Guard.RelDir<path>,
    builder?: (_: DirChain) => DirChain,
  ): DirChain

  withBase(base: string | Path.AbsDir): DirChain

  merge(...specs: SpecBuilder[]): DirChain

  /**
   * Execute all accumulated operations.
   *
   * @returns An Effect that performs all operations when run
   *
   * @example
   * ```ts
   * await Effect.runPromise(
   *   builder
   *     .file('test.txt', 'content')
   *     .commit()
   * )
   * ```
   */
  commit(): Effect.Effect<void, FSError, FS>
}

/**
 * Create a new chain builder for the given directory.
 * This is a thin wrapper around DirSpec that adds the commit() method.
 *
 * @param builder - The directory to operate on
 * @returns A new DirChain builder
 */
export const chain = (builder: Builder): DirChain => {
  // Create the underlying spec
  let spec = Spec.spec(builder.base)

  // Create a proxy that wraps the spec and adds commit()
  const createChainProxy = (currentSpec: SpecBuilder): DirChain => {
    return new Proxy(currentSpec, {
      get(target, prop) {
        // Special handling for commit()
        if (prop === 'commit') {
          return () => Ops.executeOperations(builder, target.operations as Operation[])
        }

        // Special handling for builder methods that need to return DirChain
        if (
          prop === 'file' ||
          prop === 'dir' ||
          prop === 'when' ||
          prop === 'unless' ||
          prop === 'remove' ||
          prop === 'clear' ||
          prop === 'move' ||
          prop === 'add' ||
          prop === 'withBase' ||
          prop === 'merge'
        ) {
          return (...args: any[]) => {
            // Call the underlying spec method
            const result = (target as any)[prop](...args) as SpecBuilder
            // Update our spec reference and return a new chain proxy
            spec = result
            return createChainProxy(result)
          }
        }

        // For other properties, just return from the target
        return (target as any)[prop]
      },
    }) as DirChain
  }

  return createChainProxy(spec)
}

/**
 * Extend a Builder instance with chaining methods.
 * This allows using the chaining API directly on a Builder.
 *
 * @param builder - The directory to extend
 * @returns A Builder with chaining methods
 */
export const withChaining = (builder: Builder): Builder & DirChain => {
  return Object.assign(chain(builder), builder)
}
