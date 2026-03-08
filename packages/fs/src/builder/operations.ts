import { Error as PlatformError, FileSystem } from '@effect/platform'
import { Effect } from 'effect'
import { clear, remove, rename, write } from '../filesystem.js'
import { Path } from '../path/_.js'
import type { Builder } from './builder.js'
import type { Operation } from './spec.js'

type FSError = PlatformError.PlatformError
type FS = FileSystem.FileSystem

/**
 * Execute a list of operations on a directory.
 *
 * @param builder - The base directory
 * @param operations - The operations to execute
 * @returns An Effect that executes all operations
 */
export const executeOperations = (
  builder: Builder,
  operations: Operation[],
): Effect.Effect<void, FSError, FS> =>
  Effect.gen(function* () {
    for (const op of operations) {
      yield* executeOperation(builder, op)
    }
  })

/**
 * Execute a single operation.
 */
const executeOperation = (builder: Builder, op: Operation): Effect.Effect<void, FSError, FS> =>
  Effect.gen(function* () {
    switch (op.type) {
      case 'file': {
        const absPath = Path.join(builder.base, op.path)
        yield* write(absPath, op.content)
        break
      }
      case 'dir': {
        const absPath = Path.join(builder.base, op.path)
        yield* write(absPath, { recursive: true })

        // Execute nested operations with updated base
        if (op.operations.length > 0) {
          const subBuilder = { base: absPath }
          for (const subOp of op.operations) {
            yield* executeOperation(subBuilder, subOp)
          }
        }
        break
      }
      case 'remove': {
        const absPath = Path.join(builder.base, op.path)
        yield* remove(absPath, { recursive: true, force: true })
        break
      }
      case 'clear': {
        const absPath = Path.join(builder.base, op.path)
        yield* clear(absPath)
        break
      }
      case 'move-file': {
        const fromPath = Path.join(builder.base, op.from)
        const toPath = Path.join(builder.base, op.to)
        yield* rename(fromPath, toPath)
        break
      }
      case 'move-dir': {
        const fromPath = Path.join(builder.base, op.from)
        const toPath = Path.join(builder.base, op.to)
        yield* rename(fromPath, toPath)
        break
      }
    }
  })
