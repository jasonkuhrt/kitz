import { Function as Fn, Match } from 'effect'
import type { File } from '../models/File.js'
import * as PathOptic from '../optic.js'

/**
 * Replace a file path's stem while preserving its file variant and current
 * extension. The stem follows the path module's last-dot filename rule.
 *
 * @example
 * ```ts
 * withStem(file, 'README')
 * file.pipe(withStem('README'))
 * ```
 */
export const withStem: {
  <F extends File>(file: F, stem: string): F
  (stem: string): <F extends File>(file: F) => F
} = Fn.dual(
  2,
  (file: File, stem: string): File =>
    Match.value(file).pipe(
      Match.tagsExhaustive({
        AbsFile: (abs) => PathOptic.AbsFile.stem.replace(stem, abs),
        RelFile: (rel) => PathOptic.RelFile.stem.replace(stem, rel),
      }),
    ),
)
