import { Schema as S } from 'effect'
import { format } from '../analyzer.js'
import type { FileName } from '../models/FileName.js'
import { Protocol } from '../models/Protocol.js'
import type { Segment } from '../models/segment.js'

const fileScheme = S.encodeSync(Protocol)('file')

const encodePart = (part: string): string => encodeURIComponent(part)

/** Build a `file://` URL from raw absolute-path data. Kitz paths are POSIX-only. */
export const fileUrlOf = (parts: {
  readonly segments: readonly Segment[]
  readonly fileName?: FileName
}): URL =>
  new URL(
    `${fileScheme}${format({
      isPathAbsolute: true,
      ascent: 0,
      fileName: parts.fileName ? encodePart(parts.fileName.name) : null,
    })(parts.segments.map(encodePart))}`,
  )
