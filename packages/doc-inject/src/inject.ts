import { FileSystem } from '@effect/platform'
import { Array as A, Effect, Stream } from 'effect'
import { FragmentNotFoundError, TargetFileError } from './errors.js'
import type { FragmentMap } from './extract.js'

// Single-line JSDoc with include: /** {@include id} */
const singleLinePattern = /^([ \t]*)\/\*\*\s*\{@include\s+([\w/.-]+)\}\s*\*\//gm

// Multi-line JSDoc with include (for idempotent re-runs):
// /**
//  * ...content...
//  *
//  * {@include id}
//  */
const multiLinePattern = /^([ \t]*)(\/\*\*[\s\S]*?)([ \t]*\*[ \t]*\{@include\s+([\w/.-]+)\}[ \t]*\n)([ \t]*\*\/)/gm

const formatAsJsDoc = (content: string, indent: string): string => {
  const lines = content.split('\n')
  return lines.map((line) => `${indent} * ${line}`).join('\n')
}

/**
 * Inject fragments into a source string by replacing content in JSDoc blocks
 * containing `{@include id}` directives.
 *
 * Handles both single-line (`/** {@include id} *​/`) and multi-line JSDoc formats.
 * The injection preserves the `{@include}` marker for idempotency.
 */
export const injectIntoString = (
  source: string,
  fragments: FragmentMap,
  filePath: string,
): Effect.Effect<string, FragmentNotFoundError> => {
  const missingIds: Array<string> = []

  // First pass: expand single-line includes into multi-line JSDoc
  let result = source.replace(
    singleLinePattern,
    (_match, indent: string, fragmentId: string) => {
      const content = fragments.get(fragmentId)
      if (content === undefined) {
        missingIds.push(fragmentId)
        return _match
      }
      const formattedContent = formatAsJsDoc(content, indent)
      return `${indent}/**\n${formattedContent}\n${indent} *\n${indent} * {@include ${fragmentId}}\n${indent} */`
    },
  )

  // Second pass: replace content in multi-line JSDoc (idempotent re-runs)
  result = result.replace(
    multiLinePattern,
    (_match, indent: string, _existingContent: string, includeLine: string, fragmentId: string, closer: string) => {
      const content = fragments.get(fragmentId)
      if (content === undefined) {
        missingIds.push(fragmentId)
        return _match
      }
      const formattedContent = formatAsJsDoc(content, indent)
      return `${indent}/**\n${formattedContent}\n${indent} *\n${includeLine}${closer}`
    },
  )

  if (A.isNonEmptyArray(missingIds)) {
    return Effect.fail(
      new FragmentNotFoundError({
        context: {
          fragmentId: missingIds.join(', '),
          filePath,
        },
      }),
    )
  }

  return Effect.succeed(result)
}

/**
 * Inject fragments into a single TypeScript file.
 * Reads the file, performs injection, and writes it back only if content changed.
 */
export const injectIntoFile = (
  filePath: string,
  fragments: FragmentMap,
): Effect.Effect<boolean, FragmentNotFoundError | TargetFileError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const original = yield* fs.readFileString(filePath).pipe(
      Effect.mapError(
        (error) =>
          new TargetFileError({
            context: { filePath, detail: String(error) },
          }),
      ),
    )

    const injected = yield* injectIntoString(original, fragments, filePath)

    if (injected === original) {
      return false
    }

    yield* fs.writeFileString(filePath, injected).pipe(
      Effect.mapError(
        (error) =>
          new TargetFileError({
            context: { filePath, detail: String(error) },
          }),
      ),
    )
    return true
  })

/**
 * Inject fragments into all `.ts` files found recursively under a directory.
 * Returns the list of file paths that were modified.
 */
export const injectIntoDirectory = (
  dirPath: string,
  fragments: FragmentMap,
): Effect.Effect<
  ReadonlyArray<string>,
  FragmentNotFoundError | TargetFileError,
  FileSystem.FileSystem
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    const allFiles = yield* fs.readDirectory(dirPath, { recursive: true }).pipe(
      Effect.map(Stream.fromIterable),
      Effect.flatMap(Stream.runCollect),
      Effect.map(chunk => Array.from(chunk)),
      Effect.mapError(
        (error) =>
          new TargetFileError({
            context: { filePath: dirPath, detail: String(error) },
          }),
      ),
    )

    const tsFiles = allFiles
      .filter((f): f is string => typeof f === `string`)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => (f.startsWith('/') ? f : `${dirPath}/${f}`))

    const results = yield* Effect.all(
      tsFiles.map((filePath) =>
        injectIntoFile(filePath, fragments).pipe(
          Effect.map((modified) => (modified ? filePath : null)),
        )
      ),
      { concurrency: 10 },
    )

    return results.filter((r): r is string => r !== null)
  })
