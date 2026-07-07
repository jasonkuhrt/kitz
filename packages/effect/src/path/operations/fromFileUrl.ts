import { Array, Option, Result, Schema as S, SchemaIssue } from 'effect'
import type { Abs } from '../models/Abs.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import { FileName } from '../models/FileName.js'
import { segment } from '../models/segment.js'

const invalid = (url: URL, expected: string): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(url.href), {
    message: `Expected ${expected}, received ${JSON.stringify(url.href)}`,
  })

const decodePart = (url: URL, part: string): Result.Result<string, SchemaIssue.Issue> =>
  Result.try({
    try: () => decodeURIComponent(part),
    catch: () => invalid(url, 'a percent-decodable file URL path'),
  })

/**
 * Decode a `file:` URL into an absolute typed path.
 *
 * The operation returns a `Result` instead of throwing so protocol, query /
 * fragment, percent-decoding, and path-shape failures stay in the same typed
 * failure style as the analyzer. A trailing slash in `url.pathname` decodes to
 * `AbsDir`; otherwise the last path component is decoded as the file name.
 *
 * @example
 * ```ts
 * fromFileUrl(new URL('file:///tmp/report.txt')) // Success<AbsFile>
 * fromFileUrl(new URL('file:///tmp/cache/'))     // Success<AbsDir>
 * ```
 */
export const fromFileUrl = (url: URL): Result.Result<Abs, SchemaIssue.Issue> => {
  if (url.protocol !== 'file:') return Result.fail(invalid(url, 'a file URL'))
  if (url.search || url.hash)
    return Result.fail(invalid(url, 'a file URL without query or fragment'))

  const isDir = url.pathname.endsWith('/')
  const encodedParts = url.pathname.split('/').slice(1)
  const encodedPathParts = isDir ? Array.dropRight(encodedParts, 1) : encodedParts
  const decodedParts: string[] = []

  for (const part of encodedPathParts) {
    const decoded = decodePart(url, part)
    if (Result.isFailure(decoded)) return Result.fail(decoded.failure)
    decodedParts.push(decoded.success)
  }

  return Result.try({
    try: () =>
      isDir
        ? AbsDir.make({ segments: decodedParts.map(segment) })
        : AbsFile.make({
            segments: Array.dropRight(decodedParts, 1).map(segment),
            fileName: S.decodeSync(FileName)(decodedParts[decodedParts.length - 1] ?? ''),
          }),
    catch: () => invalid(url, 'a valid absolute file path URL'),
  })
}
