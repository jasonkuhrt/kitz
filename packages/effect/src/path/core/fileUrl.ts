import { Schema as S } from 'effect'
import type { FileName } from '../models/FileName.js'
import { Protocol } from '../models/Protocol.js'
import type { Segment } from '../models/segment.js'
import { renderPath } from './render.js'

const fileScheme = S.encodeSync(Protocol)('file')

const encodePart = (part: string): string => encodeURIComponent(part)

/** Build a `file://` URL from raw absolute-path data. Kitz paths are POSIX-only. */
export const fileUrlOf = (parts: {
  readonly segments: readonly Segment[]
  readonly fileName?: FileName
}): URL =>
  new URL(
    `${fileScheme}${renderPath({
      isPathAbsolute: true,
      ascent: 0,
      segments: parts.segments.map(encodePart),
      fileName: parts.fileName ? encodePart(parts.fileName.name) : null,
    })}`,
  )
