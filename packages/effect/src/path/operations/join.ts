import { Function as Fn, Match } from 'effect'
import type { Any } from '../models/Any.js'
import { AbsDir } from '../models/AbsDir.js'
import { AbsFile } from '../models/AbsFile.js'
import type { Dir } from '../models/Dir.js'
import type { Rel } from '../models/Rel.js'
import { RelDir } from '../models/RelDir.js'
import { RelFile } from '../models/RelFile.js'

/**
 * Type-level {@link join}: the result keeps the base's absoluteness and the
 * relative path's file/dir nature.
 */
export type Join<Base extends Dir, P extends Rel> = Base extends AbsDir
  ? P extends RelFile
    ? AbsFile
    : P extends RelDir
      ? AbsDir
      : never
  : Base extends RelDir
    ? P extends RelFile
      ? RelFile
      : P extends RelDir
        ? RelDir
        : never
    : never

type JoinParts = readonly [...RelDir[], Rel]

/** Type-level variadic {@link join}: left-folds a non-empty relative path tuple. */
export type JoinMany<Base extends Dir, Parts extends JoinParts> = Parts extends readonly [
  infer Only extends Rel,
]
  ? Join<Base, Only>
  : Parts extends readonly [infer Head extends RelDir, ...infer Tail extends JoinParts]
    ? Join<Base, Head> extends Dir
      ? JoinMany<Join<Base, Head>, Tail>
      : never
    : never

const joinBinary: {
  <Base extends Dir, P extends Rel>(dir: Base, rel: P): Join<Base, P>
  <P extends Rel>(rel: P): <Base extends Dir>(dir: Base) => Join<Base, P>
} = Fn.dual(2, (dir: Dir, rel: Rel): Any => {
  const baseSegments = [...dir.segments]
  let remainingAscent = rel.ascent
  while (remainingAscent > 0 && baseSegments.length > 0) {
    baseSegments.pop()
    remainingAscent--
  }
  const segments = [...baseSegments, ...rel.segments]

  return Match.value(dir).pipe(
    Match.tagsExhaustive({
      AbsDir: () =>
        rel._tag === 'RelFile'
          ? AbsFile.make({ segments, fileName: rel.fileName })
          : AbsDir.make({ segments }),
      RelDir: (relDir) => {
        const ascent = relDir.ascent + remainingAscent
        return rel._tag === 'RelFile'
          ? RelFile.make({ ascent, segments, fileName: rel.fileName })
          : RelDir.make({ ascent, segments })
      },
    }),
  )
})

/**
 * Join one or more relative paths onto a base directory. Leading `..` steps in `rel`
 * consume trailing segments of `dir`; leftovers drop at an absolute root or fold
 * into the result's `ascent`. Keeps `dir`'s absoluteness and `rel`'s file/dir
 * nature. The variadic data-first form is a left fold; all intermediate relative
 * parts must be directories. The data-last form stays binary only.
 *
 * @example
 * ```ts
 * join(dir, rel)         // AbsFile /home/user/src/index.ts
 * join(dir, relDir, rel) // left fold
 * pipe(dir, join(rel))   // same, data-last
 * ```
 */
export const join: {
  <Base extends Dir, const Parts extends JoinParts>(
    dir: Base,
    ...rels: Parts
  ): JoinMany<Base, Parts>
  <Base extends Dir, P extends Rel>(dir: Base, rel: P): Join<Base, P>
  <P extends Rel>(rel: P): <Base extends Dir>(dir: Base) => Join<Base, P>
} = ((...args: readonly [Dir, ...JoinParts] | readonly [Rel]) => {
  if (args.length === 1) return joinBinary(args[0] as Rel)

  const [dir, first, ...rest] = args as unknown as readonly [Dir, Rel, ...Rel[]]
  let result: Any = joinBinary(dir, first)
  for (const rel of rest) {
    result = joinBinary(result as Dir, rel)
  }
  return result
}) as unknown as typeof joinBinary & {
  <Base extends Dir, const Parts extends JoinParts>(
    dir: Base,
    ...rels: Parts
  ): JoinMany<Base, Parts>
}
