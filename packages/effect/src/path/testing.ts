import { Option, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import { AbsDir as AbsDirSchema } from './models/AbsDir.js'
import { AbsFile as AbsFileSchema } from './models/AbsFile.js'
import { Any as AnySchema } from './models/Any.js'
import { FileName as FileNameSchema } from './models/FileName.js'
import { RelDir as RelDirSchema } from './models/RelDir.js'
import { RelFile as RelFileSchema } from './models/RelFile.js'
import {
  realisticDotfilePattern,
  realisticExtensionPattern,
  realisticSegmentPattern,
  realisticStemPattern,
} from './core/realisticText.js'
import { Segment as SegmentSchema } from './models/segment.js'

export const Segment = S.toArbitrary(SegmentSchema)
export const FileName = S.toArbitrary(FileNameSchema)
export const AbsDir = S.toArbitrary(AbsDirSchema)
export const AbsFile = S.toArbitrary(AbsFileSchema)
export const RelDir = S.toArbitrary(RelDirSchema)
export const RelFile = S.toArbitrary(RelFileSchema)
export const Any = S.toArbitrary(AnySchema)

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

const realisticSegment = S.toArbitrary(SegmentSchema.Realistic)

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
