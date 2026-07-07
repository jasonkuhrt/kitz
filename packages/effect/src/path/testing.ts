import { Option, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import { AbsDir as AbsDirSchema } from './models/AbsDir.js'
import { AbsFile as AbsFileSchema } from './models/AbsFile.js'
import { Any as AnySchema } from './models/Any.js'
import { FileName as FileNameSchema } from './models/FileName.js'
import { RelDir as RelDirSchema } from './models/RelDir.js'
import { RelFile as RelFileSchema } from './models/RelFile.js'
import { Segment as SegmentSchema } from './models/segment.js'

export const Segment = S.toArbitrary(SegmentSchema)
export const FileName = S.toArbitrary(FileNameSchema)
export const AbsDir = S.toArbitrary(AbsDirSchema)
export const AbsFile = S.toArbitrary(AbsFileSchema)
export const RelDir = S.toArbitrary(RelDirSchema)
export const RelFile = S.toArbitrary(RelFileSchema)
export const Any = S.toArbitrary(AnySchema)

// Realistic-name text patterns — shaped like real-world path names rather than
// the full validated character space. Heads are alphanumeric (which also rules
// out `.`/`..` and `/` by construction); bodies add the separators common in
// real names. Segment and dotfile bodies allow dots; stem and extension bodies
// do not, so the generated extension stays the sole stem–extension split point.
const alphanumeric = 'A-Za-z0-9'
const segmentBody = `${alphanumeric}._-`
const nameBody = `${alphanumeric}_-`

const realisticSegmentPattern = new RegExp(`^[${alphanumeric}][${segmentBody}]{0,31}$`)
const realisticDotfilePattern = new RegExp(`^\\.[${alphanumeric}][${segmentBody}]{0,30}$`)
const realisticStemPattern = new RegExp(`^[${alphanumeric}][${nameBody}]{0,23}$`)
const realisticExtensionPattern = new RegExp(`^\\.[${alphanumeric}][${nameBody}]{0,7}$`)

const realisticSegmentText = FastCheck.stringMatching(realisticSegmentPattern)

const realisticDotfileText = FastCheck.stringMatching(realisticDotfilePattern)
const realisticFileText = FastCheck.tuple(
  FastCheck.stringMatching(realisticStemPattern),
  FastCheck.option(FastCheck.stringMatching(realisticExtensionPattern), {
    nil: undefined,
  }),
).map(([stem, extension]) => `${stem}${extension ?? ''}`)

const canDecodeFileName = (name: string): boolean => {
  try {
    S.decodeSync(FileNameSchema)(name)
    return true
  } catch {
    return false
  }
}

const realisticSegment = FastCheck.oneof(
  { arbitrary: realisticSegmentText.map((s) => S.decodeSync(SegmentSchema)(s)), weight: 20 },
  { arbitrary: Segment, weight: 1 },
)

const realisticFileNameText = FastCheck.oneof(realisticFileText, realisticDotfileText).filter(
  canDecodeFileName,
)

const realisticFileName = FastCheck.oneof(
  {
    arbitrary: realisticFileNameText.map((name) => S.decodeSync(FileNameSchema)(name)),
    weight: 20,
  },
  { arbitrary: S.toArbitrary(FileNameSchema), weight: 1 },
)

const realisticAbsDir = FastCheck.array(realisticSegment, { maxLength: 6 }).map((segments) =>
  AbsDirSchema.make({ segments }),
)

const realisticAbsFile = FastCheck.record({
  segments: FastCheck.array(realisticSegment, { maxLength: 6 }),
  fileName: realisticFileName,
}).map((input) => AbsFileSchema.make(input))

const realisticRelDir = FastCheck.record({
  ascent: FastCheck.integer({ min: 0, max: 8 }),
  segments: FastCheck.array(realisticSegment, { maxLength: 6 }),
}).map((input) => RelDirSchema.make(input))

const realisticRelFile = FastCheck.record({
  ascent: FastCheck.integer({ min: 0, max: 8 }),
  segments: FastCheck.array(realisticSegment, { maxLength: 6 }),
  fileName: realisticFileName,
}).map((input) => RelFileSchema.make(input))

export const Realistic = {
  Segment: realisticSegment,
  FileName: realisticFileName,
  AbsDir: realisticAbsDir,
  AbsFile: realisticAbsFile,
  RelDir: realisticRelDir,
  RelFile: realisticRelFile,
  Any: FastCheck.oneof(realisticAbsDir, realisticAbsFile, realisticRelDir, realisticRelFile),

  FileNameWithoutExtension: FastCheck.oneof(realisticSegmentText, realisticDotfileText)
    .filter(canDecodeFileName)
    .map((stem) => FileNameSchema.make({ stem, extension: Option.none() })),
} as const
