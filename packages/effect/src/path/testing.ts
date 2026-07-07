import { Schema as S } from 'effect'
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

/**
 * Realistic distributions — derived from the models' `Realistic` variant
 * schemas (readable real-world-shaped values mixed 20:1 over the canonical
 * distribution; same accepted sets). Prefer these for property tests whose
 * shrunk counterexamples you want to read; use the canonical arbitraries
 * above for laws, which need the whole domain.
 */
export const Realistic = {
  Segment: S.toArbitrary(SegmentSchema.Realistic),
  FileName: S.toArbitrary(FileNameSchema.Realistic),
  AbsDir: S.toArbitrary(AbsDirSchema.Realistic),
  AbsFile: S.toArbitrary(AbsFileSchema.Realistic),
  RelDir: S.toArbitrary(RelDirSchema.Realistic),
  RelFile: S.toArbitrary(RelFileSchema.Realistic),
  Any: S.toArbitrary(AnySchema.Realistic),
} as const
