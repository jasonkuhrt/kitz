import { fileURLToPath } from 'node:url'
import { Option, Result, Schema as S, SchemaIssue } from 'effect'
import type { FileName } from '../models/FileName.js'
import { Protocol } from '../models/Protocol.js'
import type { Segment } from '../models/segment.js'
import { renderPath } from './render.js'

const fileScheme = S.encodeSync(Protocol)('file')
const fileProtocol = 'file:'

const invalid = (url: URL, expected: string): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(url.href), {
    message: `Expected ${expected}, received ${JSON.stringify(url.href)}`,
  })

const encodePart = (part: string): string => encodeURIComponent(part)

/** Build a `file://` URL from raw absolute-path data. Kitz paths are POSIX-only. */
export const fileUrlOf = (parts: {
  readonly segments: readonly (Segment | string)[]
  readonly fileName?: FileName | string
}): URL =>
  new URL(
    `${fileScheme}${renderPath({
      isPathAbsolute: true,
      ascent: 0,
      segments: parts.segments.map(encodePart),
      fileName: parts.fileName
        ? encodePart(typeof parts.fileName === 'string' ? parts.fileName : parts.fileName.name)
        : null,
    })}`,
  )

/** Decode a native file URL to its percent-decoded POSIX pathname. */
export const pathStringFromFileUrl = (url: URL): Result.Result<string, SchemaIssue.Issue> => {
  if (url.protocol !== fileProtocol) return Result.fail(invalid(url, 'a file URL'))
  if (url.host !== '' && url.host !== 'localhost')
    return Result.fail(invalid(url, 'a file URL with empty or localhost host'))
  if (url.search || url.hash)
    return Result.fail(invalid(url, 'a file URL without query or fragment'))

  return Result.try({
    try: () => fileURLToPath(url),
    catch: () => invalid(url, 'a percent-decodable file URL path'),
  })
}
