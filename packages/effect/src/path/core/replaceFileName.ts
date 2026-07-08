import { Match } from 'effect'
import { AbsFile } from '../models/AbsFile.js'
import type { File } from '../models/File.js'
import type { FileName } from '../models/FileName.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Replace a file path's `fileName`, preserving the file variant. Rebuilds
 * through the model constructors so prototypes and canonicalization hold.
 * The shared private behind `withName`/`withStem`/`withExtension`/`addExtension`.
 */
export const replaceFileName = <F extends File>(file: F, fileName: FileName): F =>
  Match.value(file as File).pipe(
    Match.tagsExhaustive({
      AbsFile: (abs) => AbsFile.make({ segments: abs.segments, fileName }),
      RelFile: (rel) => RelFile.make({ ascent: rel.ascent, segments: rel.segments, fileName }),
    }),
  ) as F
