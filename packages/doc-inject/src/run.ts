import { FileSystem } from '@effect/platform'
import { Effect } from 'effect'
import type { FragmentNotFoundError, SourceReadError, TargetFileError } from './errors.js'
import { extractFromFile } from './extract.js'
import { injectIntoDirectory } from './inject.js'

// Run the full doc-inject pipeline: extract fragments from a source markdown file,
// then inject them into all .ts files under the target directory.
export function run(options: {
  readonly source: string
  readonly target: string
}): Effect.Effect<
  ReadonlyArray<string>,
  SourceReadError | FragmentNotFoundError | TargetFileError,
  FileSystem.FileSystem
> {
  return Effect.gen(function* () {
    const fragments = yield* extractFromFile(options.source)
    const modified = yield* injectIntoDirectory(options.target, fragments)
    return modified
  })
}
