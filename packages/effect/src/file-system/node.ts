import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import { access } from 'node:fs/promises'
import { makeExists } from './operations/exists.js'
import { FileSystem } from './service.js'

// accessible → true, ENOENT → false, any other errno (e.g. ENOTDIR for a
// component that is not a directory) → propagate as a BadResource error.
const existsCheck = (path: string): Effect.Effect<boolean, PlatformError.PlatformError> =>
  Effect.tryPromise({
    try: () => access(path).then(() => true),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((cause) => {
      const code = (cause as NodeJS.ErrnoException | undefined)?.code
      return code === 'ENOENT'
        ? Effect.succeed(false)
        : Effect.fail(
            PlatformError.systemError({
              _tag: 'BadResource',
              module: 'FileSystem',
              method: 'exists',
              pathOrDescriptor: path,
              description: code ?? 'access failed',
            }),
          )
    }),
  )

/**
 * Node `FileSystem` layer — provides Kitz's own {@link FileSystem} service
 * backed by `node:fs`. Kitz owns the Node integration directly; `node:fs` lives
 * only inside this backend, never at a call site, and this module imports
 * nothing from `effect/FileSystem`.
 */
export const layerNode: Layer.Layer<FileSystem> = Layer.succeed(FileSystem)({
  exists: makeExists(existsCheck),
})
