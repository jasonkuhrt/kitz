import { FileSystem } from 'effect'
import { Effect } from 'effect'
import { SourceReadError } from './errors.js'

/**
 * A map of fragment IDs to their content strings, extracted from a markdown source.
 */
export type FragmentMap = ReadonlyMap<string, string>

/**
 * Extract all `<!-- @doc id -->...<!-- /@doc -->` fragments from a markdown string.
 *
 * @returns A map of fragment ID to trimmed content.
 */
export const extractFromString = (source: string): FragmentMap => {
  const fragmentPattern = /<!--\s*@doc\s+([\w/.-]+)\s*-->([\s\S]*?)<!--\s*\/@doc\s*-->/g
  const fragments = new Map<string, string>()
  let match: RegExpExecArray | null
  while ((match = fragmentPattern.exec(source)) !== null) {
    const id = match[1]!
    const content = match[2]!.trim()
    fragments.set(id, content)
  }
  return fragments
}

/**
 * Extract all `<!-- @doc id -->...<!-- /@doc -->` fragments from a markdown file.
 *
 * @param filePath - Absolute path to the markdown source file.
 * @returns Effect yielding a map of fragment ID to trimmed content.
 */
export function extractFromFile(
  filePath: string,
): Effect.Effect<FragmentMap, SourceReadError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(filePath).pipe(
      Effect.mapError(
        (error) =>
          new SourceReadError({
            context: {
              filePath,
              detail: error instanceof Error ? error.message : JSON.stringify(error),
            },
          }),
      ),
    )
    return extractFromString(content)
  })
}
