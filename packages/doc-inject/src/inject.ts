import { FileSystem } from '@effect/platform'
import { Array as A, Effect, Stream } from 'effect'
import { FragmentNotFoundError, TargetFileError } from './errors.js'
import type { FragmentMap } from './extract.js'

// Regex matching a JSDoc block that contains an {@include id} directive.
//
// Captures:
// - Group 1: The indentation before the opening
// - Group 2: Everything from the opening up to (but not including) the include line
// - Group 3: The include line itself
// - Group 4: The fragment ID
// - Group 5: The closing
const jsDocIncludePattern = /^([ \t]*)(\/\*\*[\s\S]*?)([ \t]*\*[ \t]*\{@include\s+([\w/.-]+)\}[ \t]*\n)([ \t]*\*\/)/gm

const formatAsJsDoc = (content: string, indent: string): string => {
  const lines = content.split('\n')
  return lines.map((line) => `${indent} * ${line}`).join('\n')
}

// Inject fragments into a source string by replacing content in JSDoc blocks
// containing {@include id} directives.
//
// The injection replaces everything between the opening and the include line
// with the formatted fragment content, preserving the include marker for idempotency.
export const injectIntoString = (
  source: string,
  fragments: FragmentMap,
  filePath: string,
): Effect.Effect<string, FragmentNotFoundError> => {
  const missingIds: Array<string> = []

  const result = source.replace(
    jsDocIncludePattern,
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

// Inject fragments into a single TypeScript file.
// Reads the file, performs injection, and writes it back only if content changed.
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

// Inject fragments into all .ts files found recursively under a directory.
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
