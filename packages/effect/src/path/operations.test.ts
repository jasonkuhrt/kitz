import { describe, expect, it } from 'vite-plus/test'
import { Equal, Option, Result, Schema as S } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'

const abs = FastCheck.oneof(Path.Testing.AbsDir, Path.Testing.AbsFile)
const dir = FastCheck.oneof(Path.Testing.AbsDir, Path.Testing.RelDir)
const rel = FastCheck.oneof(Path.Testing.RelDir, Path.Testing.RelFile)
const relDirAscent0 = FastCheck.array(Path.Testing.Segment, { maxLength: 6 }).map((segments) =>
  Path.RelDir.make({ ascent: 0, segments }),
)
const relFileAscent0 = FastCheck.record({
  segments: FastCheck.array(Path.Testing.Segment, { maxLength: 6 }),
  fileName: Path.Testing.FileName,
}).map((input) => Path.RelFile.make({ ascent: 0, ...input }))
const relAscent0 = FastCheck.oneof(relDirAscent0, relFileAscent0)
const nonEmptyRelAscent0 = FastCheck.oneof(
  FastCheck.array(Path.Testing.Segment, { minLength: 1, maxLength: 6 }).map((segments) =>
    Path.RelDir.make({ ascent: 0, segments }),
  ),
  relFileAscent0,
)

const encodeAny = S.encodeSync(Path.Any)

const iterateAbsParents = <P extends Path.AbsDir | Path.AbsFile>(
  path: P,
): readonly Path.AbsDir[] => {
  if (Path.AbsDir.is(path) && path.isRoot) return []

  const ancestors: Path.AbsDir[] = []
  let current = path._tag === 'AbsFile' ? path.dir : path.parent
  while (true) {
    ancestors.push(current)
    const next = current.parent
    if (Equal.equals(next, current)) return ancestors
    current = next
  }
}

const extension = (value: string) => S.decodeSync(Path.Extension.Extension)(value)
const fileName = (value: string) => S.decodeSync(Path.FileName)(value)
const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0)
const canDecodeFileName = (value: string): boolean =>
  Result.isSuccess(S.decodeUnknownResult(Path.FileName)(value))

const unionLiteralCases = [
  'a/../b',
  './x/./y/',
  '//',
  '.',
  '..',
  '',
  './.env.local',
  '/a/b',
  'x.',
  './.gitignore',
  '/',
  '/a/b/',
  '/releases/v1.2',
  '/etc/hostname',
  '/u/.gitignore',
  './',
  '../',
  '../x',
  '../x/',
  './x',
  './x/',
] as const

describe('Path operation laws', () => {
  it('join(base, relativeTo(abs, base)) returns the original absolute path', () => {
    FastCheck.assert(
      FastCheck.property(abs, Path.Testing.AbsDir, (path, base) => {
        expect(Path.join(base, Path.relativeTo(path, base))).toEqual(path)
      }),
    )
  })

  it('relative relativeTo is Some exactly when target ascent is not shallower than base ascent', () => {
    FastCheck.assert(
      FastCheck.property(rel, Path.Testing.RelDir, (target, base) => {
        const relative = Path.relativeTo(target, base)
        const isExpressible = target.ascent >= base.ascent

        expect(Option.isSome(relative)).toBe(isExpressible)
        expect(Option.map(relative, (value) => Path.join(base, value))).toEqual(
          isExpressible ? Option.some(target) : Option.none(),
        )
      }),
    )
  })

  it('relativeTo(join(base, r), base) returns ascent-0 relative paths', () => {
    FastCheck.assert(
      FastCheck.property(dir, relAscent0, (base, r) => {
        const joined = Path.join(base, r)
        const relative = Path.relativeTo(joined as never, base as never)
        const relativeOption = Option.isOption(relative) ? relative : Option.some(relative)

        expect(relativeOption).toEqual(Option.some(r))
      }),
    )
  })

  it('joining a non-empty ascent-0 relative path makes it a descendant', () => {
    FastCheck.assert(
      FastCheck.property(dir, nonEmptyRelAscent0, (base, r) => {
        const child = Path.join(base, r)
        expect(Path.isDescendantOf(child as never, base as never)).toBe(true)
      }),
    )
  })

  it('isAncestorOf is the inverse of isDescendantOf', () => {
    FastCheck.assert(
      FastCheck.property(dir, Path.Testing.Any, (base, child) => {
        const sameGroup =
          (Path.AbsDir.is(base) && Path.Abs.is(child)) ||
          (Path.RelDir.is(base) && Path.Rel.is(child))
        if (!sameGroup) return

        expect(Path.isAncestorOf(base as never, child as never)).toBe(
          Path.isDescendantOf(child as never, base as never),
        )
      }),
    )
  })

  it('getSharedBase is symmetric and returns an ancestor of both paths', () => {
    FastCheck.assert(
      FastCheck.property(Path.Testing.Any, Path.Testing.Any, (a, b) => {
        const ab = Path.getSharedBase(a as never, b as never)
        const ba = Path.getSharedBase(b as never, a as never)

        expect(ab).toEqual(ba)
        expect(
          Option.match(ab, {
            onNone: () => true,
            onSome: (shared) =>
              Path.isAncestorOf(shared as never, a as never) &&
              Path.isAncestorOf(shared as never, b as never),
          }),
        ).toBe(true)
      }),
    )
  })

  it('getSharedBase agrees with descendant checks for directory parents', () => {
    FastCheck.assert(
      FastCheck.property(dir, nonEmptyRelAscent0, (base, r) => {
        const child = Path.join(base, r)
        const shared = Path.getSharedBase(base as never, child as never)

        expect(Path.isDescendantOf(child as never, base as never)).toBe(true)
        expect(shared).toEqual(base.segments.length === 0 ? Option.none() : Option.some(base))
      }),
    )
  })

  it('ensureAbs is idempotent and reference-preserving for absolute inputs', () => {
    FastCheck.assert(
      FastCheck.property(Path.Testing.Any, Path.Testing.AbsDir, (path, base) => {
        const ensured = Path.ensureAbs(path, base)
        expect(Path.ensureAbs(ensured, base)).toBe(ensured)
        expect(Path.Abs.is(path) ? ensured === path : true).toBe(true)
      }),
    )
  })

  it('parent handles roots and segment-less relatives', () => {
    const root = Path.AbsDir.make({ segments: [] })
    expect(root.parent).toEqual(root)

    FastCheck.assert(
      FastCheck.property(FastCheck.integer({ min: 0, max: 8 }), (ascent) => {
        const relRoot = Path.RelDir.make({ ascent, segments: [] })
        expect(relRoot.parent.ascent).toBe(ascent + 1)
        expect(relRoot.parent.segments).toEqual([])
      }),
    )
  })

  it('absolute ancestors equal repeated parent iteration to a fixed point', () => {
    FastCheck.assert(
      FastCheck.property(abs, (path) => {
        expect(path.ancestors).toEqual(iterateAbsParents(path))
      }),
    )
  })

  it('relative ancestors are finite segment drops ending at the same anchor', () => {
    FastCheck.assert(
      FastCheck.property(rel, (path) => {
        const ancestors = path.ancestors
        expect(ancestors.map((a) => a.ascent)).toEqual(ancestors.map(() => path.ascent))
        expect(ancestors.length).toBe(path.segments.length + (Path.RelFile.is(path) ? 1 : 0))
        expect(ancestors.at(-1)).toEqual(
          ancestors.length === 0
            ? undefined
            : Path.RelDir.make({ ascent: path.ascent, segments: [] }),
        )
      }),
    )
  })

  it('file getters and transforms stay consistent', () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.oneof(Path.Testing.AbsFile, Path.Testing.RelFile), (file) => {
        expect(file.name).toBe(`${file.stem}${Option.getOrElse(file.extension, () => '')}`)
        expect(file.dir.segments).toEqual(file.segments)
        expect(Path.RelFile.is(file) ? file.dir.ascent : 0).toBe(
          Path.RelFile.is(file) ? file.ascent : 0,
        )

        const renamed = Path.withName(file, fileName('renamed.txt'))
        expect(renamed.name).toBe('renamed.txt')
        expect(renamed._tag).toBe(file._tag)

        const stemmed = Path.withStem(file, 'next')
        expect(stemmed.stem).toBe('next')
        expect(stemmed._tag).toBe(file._tag)

        const withAddedExtension = Path.addExtension(file, extension('.gz'))
        expect(withAddedExtension.name).toBe(`${file.name}.gz`)
      }),
    )
  })

  it('withExtension Option.none drops when the remaining stem is a filename', () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.oneof(Path.Testing.AbsFile, Path.Testing.RelFile), (file) => {
        FastCheck.pre(canDecodeFileName(file.stem))
        expect(Path.withExtension(file, Option.none()).name).toBe(file.stem)
      }),
    )
  })

  it('asDir/asFile round trip and root directories do not reinterpret as files', () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.oneof(Path.Testing.AbsFile, Path.Testing.RelFile), (file) => {
        expect(file.asDir.asFile).toEqual(Option.some(file))
      }),
    )

    expect(Path.AbsDir.make({ segments: [] }).asFile).toEqual(Option.none())
    expect(Path.RelDir.make({ ascent: 0, segments: [] }).asFile).toEqual(Option.none())
  })

  it('file optics satisfy lens laws and preserve prototypes', () => {
    const file = S.decodeSync(Path.AbsFile)('/a/b/source.ts')

    expect(Path.Optic.AbsFile.stem.replace(Path.Optic.AbsFile.stem.get(file), file)).toEqual(file)

    const replaced = Path.Optic.AbsFile.stem.replace('target', file)
    expect(Path.Optic.AbsFile.stem.get(replaced)).toBe('target')
    expect(replaced.parent).toEqual(S.decodeSync(Path.AbsFile)('/a/target.ts'))

    const renamed = Path.Optic.AbsFile.fileName.replace(fileName('index.js'), file)
    expect(renamed.parent).toEqual(S.decodeSync(Path.AbsFile)('/a/b/index.js').parent)
  })

  it('variant prisms satisfy get/set laws', () => {
    const absFile = S.decodeSync(Path.AbsFile)('/a/b.txt')
    const relDir = S.decodeSync(Path.RelDir)('./a/')

    expect(Path.Optic.absFile.set(absFile)).toEqual(absFile)
    expect(Path.Optic.absFile.getResult(Path.Optic.absFile.set(absFile))).toEqual(
      Result.succeed(absFile),
    )
    expect(Result.isFailure(Path.Optic.absFile.getResult(relDir))).toBe(true)
  })

  it('Path.order is reflexive, antisymmetric, transitive, and agrees with Equal', () => {
    FastCheck.assert(
      FastCheck.property(Path.Testing.Any, Path.Testing.Any, Path.Testing.Any, (a, b, c) => {
        const ab = Path.order(a, b)
        const ba = Path.order(b, a)
        const bc = Path.order(b, c)
        const ac = Path.order(a, c)

        expect(Path.order(a, a)).toBe(0)
        expect(sign(ab)).toBe(sign(-ba))
        expect(ab > 0 || bc > 0 || ac <= 0).toBe(true)
        expect(ab === 0).toBe(Equal.equals(a, b))
      }),
    )
  })

  it('fileUrl round trips through fromFileUrl', () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.oneof(Path.Testing.AbsDir, Path.Testing.AbsFile), (path) => {
        const decoded = Path.fromFileUrl(path.fileUrl)
        expect(decoded).toEqual(Result.succeed(path))
      }),
    )
  })

  it.each([
    S.decodeSync(Path.AbsFile)('/tmp/a b.txt'),
    S.decodeSync(Path.AbsFile)('/tmp/100%.txt'),
    S.decodeSync(Path.AbsFile)('/tmp/q?a.txt'),
    S.decodeSync(Path.AbsFile)('/tmp/h#a.txt'),
    S.decodeSync(Path.AbsFile)('/tmp/cafe\u0301.txt'),
    S.decodeSync(Path.AbsDir)('/tmp/a b/'),
  ])('file URL regression: %s', (path) => {
    expect(Path.fromFileUrl(path.fileUrl)).toEqual(Result.succeed(path))
  })

  it('variadic join is a left fold of binary join', () => {
    FastCheck.assert(
      FastCheck.property(
        dir,
        relDirAscent0,
        relDirAscent0,
        relAscent0,
        (base, first, second, last) => {
          expect(Path.join(base, first, second, last)).toEqual(
            Path.join(Path.join(Path.join(base, first), second), last),
          )
        },
      ),
    )
  })

  it('tagged union match and guards agree with variant tags and S.is', () => {
    FastCheck.assert(
      FastCheck.property(Path.Testing.Any, (path) => {
        const tag = Path.Any.match(path, {
          AbsDir: () => 'AbsDir',
          AbsFile: () => 'AbsFile',
          RelDir: () => 'RelDir',
          RelFile: () => 'RelFile',
        })
        const guard = Path.Any.match(path, {
          AbsDir: (value) => Path.Any.guards.AbsDir(value),
          AbsFile: (value) => Path.Any.guards.AbsFile(value),
          RelDir: (value) => Path.Any.guards.RelDir(value),
          RelFile: (value) => Path.Any.guards.RelFile(value),
        })
        const schema = Path.Any.match(path, {
          AbsDir: (value) => S.is(Path.Any.cases.AbsDir)(value),
          AbsFile: (value) => S.is(Path.Any.cases.AbsFile)(value),
          RelDir: (value) => S.is(Path.Any.cases.RelDir)(value),
          RelFile: (value) => S.is(Path.Any.cases.RelFile)(value),
        })

        expect(tag).toBe(path._tag)
        expect(guard).toBe(true)
        expect(schema).toBe(true)
      }),
    )
  })

  it('string, JSON, and PrimaryKey traits use the canonical encoded string', () => {
    FastCheck.assert(
      FastCheck.property(Path.Testing.Any, (path) => {
        const encoded = encodeAny(path)
        expect(String(path)).toBe(encoded)
        expect(path.toJSON()).toBe(encoded)
        expect(path[PrimaryKey.symbol]()).toBe(encoded)
      }),
    )
  })

  it.each(unionLiteralCases)('fromLiteral(%s) agrees with union decode', (input) => {
    expect(Path.fromLiteral(input)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
  })
})
