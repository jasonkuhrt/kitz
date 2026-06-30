import { Function as Fn, Schema as S } from 'effect'
import { join } from '../operators/join.js'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import { Path } from './Path.js'
import { Rel } from './Rel.js'
import { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'
import { unionEquivalence } from './_equivalence.js'

/** Type-level {@link Abs.ensure}: absolute paths pass through; relative become absolute. */
type Ensure<P extends Path> = P extends Abs
  ? P
  : P extends RelFile
    ? AbsFile
    : P extends RelDir
      ? AbsDir
      : never

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 */
class Abs_ extends S.asClass(S.Union([AbsFile, AbsDir])) {
  static readonly AbsFile = AbsFile
  static readonly AbsDir = AbsDir
  static readonly is = S.is(Abs_)
  static readonly equivalence = unionEquivalence<typeof Abs_.Type>({
    AbsFile: AbsFile.equivalence,
    AbsDir: AbsDir.equivalence,
  })

  /**
   * Ensure a path is absolute, resolving a relative path against `base`; absolute
   * inputs pass through. Dual: `Abs.ensure(path, base)` or `Abs.ensure(base)` for
   * piping.
   *
   * @example
   * ```ts
   * Abs.ensure(relFile, cwd)         // AbsFile resolved against cwd
   * pipe(relFile, Abs.ensure(cwd))   // same, data-last
   * ```
   */
  static readonly ensure: {
    <P extends Path>(path: P, base: AbsDir): Ensure<P>
    (base: AbsDir): <P extends Path>(path: P) => Ensure<P>
  } = Fn.dual(
    2,
    (path: Path, base: AbsDir): Path => (Abs_.is(path) ? path : join(base, path as Rel)),
  )
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type
