/**
 * Path module test suite — organized by FEATURE, not by assertion mechanism.
 *
 * One feature → one test locus. Whether a feature's contract is checked at
 * build time (`expectTypeOf`, `@ts-expect-error`) or run time (laws, tables)
 * is incidental; both kinds of assertion live in the SAME describe block.
 * Deleting a feature means deleting one block — never hunting a parallel
 * type-test file.
 *
 * Cross-feature laws live with the operation whose documented contract states
 * them (e.g. `isAncestorOf` documents itself as the inverse of
 * `isDescendantOf`, so the mirror law lives there).
 */
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Equal, Option, Result, Schema as S } from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'
import * as PathTesting from './testing.js'

// ─── shared generators & helpers ───

const abs = FastCheck.oneof(PathTesting.AbsDir, PathTesting.AbsFile)
const dir = FastCheck.oneof(PathTesting.AbsDir, PathTesting.RelDir)
const rel = FastCheck.oneof(PathTesting.RelDir, PathTesting.RelFile)
const file = FastCheck.oneof(PathTesting.AbsFile, PathTesting.RelFile)
const relDirAscent0 = FastCheck.array(PathTesting.Segment, { maxLength: 6 }).map((segments) =>
  Path.RelDir.make({ ascent: 0, segments }),
)
const relFileAscent0 = FastCheck.record({
  segments: FastCheck.array(PathTesting.Segment, { maxLength: 6 }),
  fileName: PathTesting.FileName,
}).map((input) => Path.RelFile.make({ ascent: 0, ...input }))
const relAscent0 = FastCheck.oneof(relDirAscent0, relFileAscent0)
const nonEmptyRelAscent0 = FastCheck.oneof(
  FastCheck.array(PathTesting.Segment, { minLength: 1, maxLength: 6 }).map((segments) =>
    Path.RelDir.make({ ascent: 0, segments }),
  ),
  relFileAscent0,
)

const encodeAny = S.encodeSync(Path.Any)
const extension = (value: string) => S.decodeSync(Path.Extension.Extension)(value)
const fileName = (value: string) => S.decodeSync(Path.FileName)(value)
const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0)
const canDecodeFileName = (value: string): boolean =>
  Result.isSuccess(S.decodeUnknownResult(Path.FileName)(value))

const someAbsFile = Path.AbsFile.make({
  segments: ['home', 'src'],
  fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
})
const someAbsDir = Path.AbsDir.make({ segments: ['home'] })
const someRelFile = Path.RelFile.make({
  ascent: 0,
  segments: ['src'],
  fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
})
const someRelDir = Path.RelDir.make({ ascent: 0, segments: ['src'] })

// ─── codec: the string ⇄ value contract, parameterized over every model ───

const codecCases = [
  ['AbsDir', Path.AbsDir, PathTesting.AbsDir],
  ['AbsFile', Path.AbsFile, PathTesting.AbsFile],
  ['RelDir', Path.RelDir, PathTesting.RelDir],
  ['RelFile', Path.RelFile, PathTesting.RelFile],
  ['Abs', Path.Abs, FastCheck.oneof(PathTesting.AbsDir, PathTesting.AbsFile)],
  ['Rel', Path.Rel, FastCheck.oneof(PathTesting.RelDir, PathTesting.RelFile)],
  ['Dir', Path.Dir, FastCheck.oneof(PathTesting.AbsDir, PathTesting.RelDir)],
  ['File', Path.File, FastCheck.oneof(PathTesting.AbsFile, PathTesting.RelFile)],
  ['Any', Path.Any, PathTesting.Any],
] as const

const canonicalizationCases = [
  ['a/../b', 'RelFile', './b'],
  ['./x/./y/', 'RelDir', './x/y/'],
  ['//', 'AbsDir', '/'],
  ['.', 'RelDir', './'],
  ['..', 'RelDir', '../'],
  ['', 'RelDir', './'],
  ['./.env.local', 'RelFile', './.env.local'],
  ['/a/b', 'AbsFile', '/a/b'],
  ['x.', 'RelDir', './x./'],
  ['./.gitignore', 'RelFile', './.gitignore'],
] as const

const unionVariantCases = [
  ...canonicalizationCases,
  ['/', 'AbsDir', '/'],
  ['/a/b/', 'AbsDir', '/a/b/'],
  ['/releases/v1.2', 'AbsFile', '/releases/v1.2'],
  ['/etc/hostname', 'AbsFile', '/etc/hostname'],
  ['/u/.gitignore', 'AbsFile', '/u/.gitignore'],
  ['./', 'RelDir', './'],
  ['../', 'RelDir', '../'],
  ['../x', 'RelFile', '../x'],
  ['../x/', 'RelDir', '../x/'],
  ['./x', 'RelFile', './x'],
  ['./x/', 'RelDir', './x/'],
] as const

describe('codec', () => {
  it.each(codecCases)('%s decode(encode(value)) is identity', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)
    const decode = S.decodeSync(schema)

    FastCheck.assert(
      FastCheck.property(arbitrary as FastCheck.Arbitrary<never>, (path) => {
        expect(decode(encode(path))).toEqual(path)
      }),
    )
  })

  it.each(codecCases)('%s encode(decode(canonical)) is idempotent', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)
    const decode = S.decodeSync(schema)

    FastCheck.assert(
      FastCheck.property(arbitrary as FastCheck.Arbitrary<never>, (path) => {
        const canonical = encode(path)
        expect(encode(decode(canonical))).toBe(canonical)
      }),
    )
  })

  it.each(canonicalizationCases)('%s canonicalizes as %s %s', (input, tag, canonical) => {
    const path = S.decodeSync(Path.Any)(input)
    expect(path._tag).toBe(tag)
    expect(path).toEncodeTo(canonical)
    expect(S.encodeSync(Path.Any)(S.decodeSync(Path.Any)(canonical))).toBe(canonical)
  })

  it.each(unionVariantCases)('Any decodes %s as %s', (input, tag, canonical) => {
    const path = S.decodeSync(Path.Any)(input)
    expect(path._tag).toBe(tag)
    expect(path).toEncodeTo(canonical)
  })

  it.each(codecCases)('%s Equal agrees with canonical encoding', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)

    FastCheck.assert(
      FastCheck.property(
        arbitrary as FastCheck.Arbitrary<never>,
        arbitrary as FastCheck.Arbitrary<never>,
        (a, b) => {
          expect(Equal.equals(a, b)).toBe(encode(a) === encode(b))
        },
      ),
    )
  })

  it('explicit directory targets accept extension-looking names without trailing slash', () => {
    const decoded = S.decodeSync(Path.AbsDir)('/releases/v1.2')

    expect(decoded).toBeAbs()
    expect(decoded).toBeDir()
    expect(decoded).toEncodeTo('/releases/v1.2/')
  })

  it('explicit file targets accept extensionless files and dotfiles', () => {
    const hostname = S.decodeSync(Path.AbsFile)('/etc/hostname')
    const dotfile = S.decodeSync(Path.AbsFile)('/u/.gitignore')
    const env = S.decodeSync(Path.RelFile)('./.env.local')

    expect(hostname).toBeAbs()
    expect(hostname).toBeFile()
    expect(hostname).toEncodeTo('/etc/hostname')
    expect(dotfile).toEncodeTo('/u/.gitignore')
    expect(env).toBeRel()
    expect(env).toEncodeTo('./.env.local')
  })
})

// ─── JSON Schema emission ───

describe('JSON Schema', () => {
  it.each([
    ['AbsFile', Path.AbsFile],
    ['AbsDir', Path.AbsDir],
    ['RelFile', Path.RelFile],
    ['RelDir', Path.RelDir],
  ] as const)('%s emits a self-describing string schema', (name, schema) => {
    const document = S.toJsonSchemaDocument(schema)
    const definition = document.definitions[name] as {
      type?: string
      title?: string
      description?: string
      examples?: readonly string[]
    }

    expect(definition.type).toBe('string')
    expect(definition.title).toBeTruthy()
    expect(definition.description).toBeTruthy()
    expect(definition.examples?.length).toBeGreaterThan(0)
  })
})

// ─── union utilities (toTaggedUnion) ───

describe('union utilities', () => {
  it('match and guards agree with variant tags and S.is', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, (path) => {
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

  it('types: union member access matches the organizing-principle table', () => {
    const anyPath = someAbsFile as Path.Any

    expectTypeOf(anyPath.parent).toEqualTypeOf<Path.Any>()
    // @ts-expect-error stem is file-only — absent from the Any union
    void anyPath.stem
  })
})

// ─── getters: name / stem / extension ───

describe('.name / .stem / .extension', () => {
  it('file name is stem plus extension', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        expect(f.name).toBe(`${f.stem}${Option.getOrElse(f.extension, () => '')}`)
      }),
    )
  })

  it('types: files are honest strings, dirs are honest Options', () => {
    expectTypeOf(someAbsFile.name).toEqualTypeOf<string>()
    expectTypeOf(someRelFile.name).toEqualTypeOf<string>()
    expectTypeOf(someAbsFile.stem).toEqualTypeOf<string>()
    expectTypeOf(someAbsFile.extension).toEqualTypeOf<Option.Option<Path.Extension.Extension>>()
    expectTypeOf(someAbsDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
    expectTypeOf(someRelDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
  })
})

// ─── getters: dir ───

describe('.dir', () => {
  it('is the containing directory with the same segments and ascent', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        expect(f.dir.segments).toEqual(f.segments)
        expect(Path.RelFile.is(f) ? f.dir.ascent : 0).toBe(Path.RelFile.is(f) ? f.ascent : 0)
      }),
    )
  })

  it('types: variant-precise', () => {
    expectTypeOf(someAbsFile.dir).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(someRelFile.dir).toEqualTypeOf<Path.RelDir>()
  })
})

// ─── getters: parent ───

describe('.parent', () => {
  it('handles roots and segment-less relatives', () => {
    const root = Path.AbsDir.make({ segments: [] })
    expect(root).toBeRoot()
    expect(root.parent).toEqual(root)

    FastCheck.assert(
      FastCheck.property(FastCheck.integer({ min: 0, max: 8 }), (ascent) => {
        const relRoot = Path.RelDir.make({ ascent, segments: [] })
        expect(relRoot.parent.ascent).toBe(ascent + 1)
        expect(relRoot.parent.segments).toEqual([])
      }),
    )
  })

  it('types: variant-preserving', () => {
    expectTypeOf(someAbsFile.parent).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(someAbsDir.parent).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(someRelFile.parent).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(someRelDir.parent).toEqualTypeOf<Path.RelDir>()
  })
})

// ─── getters: ancestors ───

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

describe('.ancestors', () => {
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
})

// ─── getters: isRoot / depth ───

describe('.isRoot / .depth', () => {
  it('isRoot is true exactly for segment-less, ascent-0 paths', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, (path) => {
        const ascent = Path.Rel.is(path) ? path.ascent : 0
        expect(path.isRoot).toBe(path.segments.length === 0 && ascent === 0)
      }),
    )
  })

  it('depth is the segment count (files exclude the filename)', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, (path) => {
        expect(path.depth).toBe(path.segments.length)
      }),
    )
  })
})

// ─── getters: asDir / asFile ───

describe('.asDir / .asFile', () => {
  it('round trips files and refuses to reinterpret roots', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        expect(f.asDir.asFile).toEqual(Option.some(f))
      }),
    )

    expect(Path.AbsDir.make({ segments: [] }).asFile).toEqual(Option.none())
    expect(Path.RelDir.make({ ascent: 0, segments: [] }).asFile).toEqual(Option.none())
  })
})

// ─── getters: atRoot ───

describe('.atRoot', () => {
  it('re-anchors relatives at the root, dropping ascent and keeping segments', () => {
    FastCheck.assert(
      FastCheck.property(rel, (path) => {
        const rooted = path.atRoot
        expect(rooted.segments).toEqual(path.segments)
        expect(Path.RelFile.is(path) ? Option.some(path.fileName) : Option.none()).toEqual(
          Path.AbsFile.is(rooted) ? Option.some(rooted.fileName) : Option.none(),
        )
      }),
    )
  })

  it('types: maps rel variants to abs counterparts', () => {
    expectTypeOf(someRelFile.atRoot).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(someRelDir.atRoot).toEqualTypeOf<Path.AbsDir>()
  })
})

// ─── URL interop: fileUrl / fromFileUrl ───

describe('fileUrl / fromFileUrl', () => {
  it('round trips through fromFileUrl', () => {
    FastCheck.assert(
      FastCheck.property(abs, (path) => {
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
    S.decodeSync(Path.AbsFile)('/tmp/café.txt'),
    S.decodeSync(Path.AbsDir)('/tmp/a b/'),
  ])('percent-encoding regression: %s', (path) => {
    expect(Path.fromFileUrl(path.fileUrl)).toEqual(Result.succeed(path))
  })
})

// ─── operation: join ───

describe('join', () => {
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

  it('types: all four Join cells; data-first and data-last agree', () => {
    expectTypeOf(Path.join(someAbsDir, someRelDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(someAbsDir, someRelFile)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.join(someRelDir, someRelDir)).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.join(someRelDir, someRelFile)).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.join(someRelDir)(someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.join(someRelFile)(someAbsDir)).toEqualTypeOf<Path.AbsFile>()
  })
})

// ─── operation: relativeTo ───

describe('relativeTo', () => {
  it('join(base, relativeTo(abs, base)) returns the original absolute path', () => {
    FastCheck.assert(
      FastCheck.property(abs, PathTesting.AbsDir, (path, base) => {
        expect(Path.join(base, Path.relativeTo(path, base))).toEqual(path)
      }),
    )
  })

  it('relative relativeTo is Some exactly when target ascent is not shallower than base ascent', () => {
    FastCheck.assert(
      FastCheck.property(rel, PathTesting.RelDir, (target, base) => {
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

  it('types: variant-precise; data-first and data-last agree', () => {
    expectTypeOf(Path.relativeTo(someAbsFile, someAbsDir)).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.relativeTo(someAbsDir)(someAbsFile)).toEqualTypeOf<Path.RelFile>()
  })
})

// ─── operation: ensureAbs ───

describe('ensureAbs', () => {
  it('is idempotent and reference-preserving for absolute inputs', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, PathTesting.AbsDir, (path, base) => {
        const ensured = Path.ensureAbs(path, base)
        expect(Path.ensureAbs(ensured, base)).toBe(ensured)
        expect(Path.Abs.is(path) ? ensured === path : true).toBe(true)
      }),
    )
  })

  it('types: EnsureAbs mapping; data-first and data-last agree', () => {
    expectTypeOf(Path.ensureAbs(someRelDir, someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs(someAbsDir)(someRelDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.ensureAbs(someRelFile, someAbsDir)).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.ensureAbs(someAbsFile, someAbsDir)).toEqualTypeOf<Path.AbsFile>()
  })
})

// ─── operation: isDescendantOf ───

describe('isDescendantOf', () => {
  it('joining a non-empty ascent-0 relative path makes it a descendant', () => {
    FastCheck.assert(
      FastCheck.property(dir, nonEmptyRelAscent0, (base, r) => {
        const child = Path.join(base, r)
        expect(child).toBeWithinPath(base)
      }),
    )
  })
})

// ─── operation: isAncestorOf ───

describe('isAncestorOf', () => {
  it('is the inverse of isDescendantOf', () => {
    FastCheck.assert(
      FastCheck.property(dir, PathTesting.Any, (base, child) => {
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
})

// ─── operation: getSharedBase ───

describe('getSharedBase', () => {
  it('is symmetric and returns an ancestor of both paths', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, PathTesting.Any, (a, b) => {
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

  it('agrees with descendant checks for directory parents', () => {
    FastCheck.assert(
      FastCheck.property(dir, nonEmptyRelAscent0, (base, r) => {
        const child = Path.join(base, r)
        const shared = Path.getSharedBase(base as never, child as never)

        expect(Path.isDescendantOf(child as never, base as never)).toBe(true)
        expect(shared).toEqual(base.segments.length === 0 ? Option.none() : Option.some(base))
      }),
    )
  })
})

// ─── operation: order ───

describe('order', () => {
  it('is reflexive, antisymmetric, transitive, and agrees with Equal', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, PathTesting.Any, PathTesting.Any, (a, b, c) => {
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
})

// ─── operations: with* / addExtension ───

describe('withName / withStem / withExtension / addExtension', () => {
  it('transform the filename while preserving the variant', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        const renamed = Path.withName(f, fileName('renamed.txt'))
        expect(renamed.name).toBe('renamed.txt')
        expect(renamed._tag).toBe(f._tag)

        const stemmed = Path.withStem(f, 'next')
        expect(stemmed.stem).toBe('next')
        expect(stemmed._tag).toBe(f._tag)

        const withAddedExtension = Path.addExtension(f, extension('.gz'))
        expect(withAddedExtension.name).toBe(`${f.name}.gz`)
      }),
    )
  })

  it('withExtension Option.none drops when the remaining stem is a filename', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        FastCheck.pre(canDecodeFileName(f.stem))
        expect(Path.withExtension(f, Option.none()).name).toBe(f.stem)
      }),
    )
  })
})

// ─── optics ───

describe('Optic', () => {
  it('file optics satisfy lens laws and preserve prototypes', () => {
    const source = S.decodeSync(Path.AbsFile)('/a/b/source.ts')

    expect(Path.Optic.AbsFile.stem.replace(Path.Optic.AbsFile.stem.get(source), source)).toEqual(
      source,
    )

    const replaced = Path.Optic.AbsFile.stem.replace('target', source)
    expect(Path.Optic.AbsFile.stem.get(replaced)).toBe('target')
    expect(replaced.parent).toEqual(S.decodeSync(Path.AbsFile)('/a/target.ts'))

    const renamed = Path.Optic.AbsFile.fileName.replace(fileName('index.js'), source)
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
})

// ─── literals: fromLiteral + per-target constructors ───

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

describe('fromLiteral', () => {
  it.each(unionLiteralCases)('fromLiteral(%s) agrees with union decode', (input) => {
    expect(Path.fromLiteral(input)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
  })

  it('types: literal shapes infer precise variants; plain string degrades to Any', () => {
    expectTypeOf(Path.fromLiteral('/home/u/f.txt')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.fromLiteral('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.fromLiteral('./.gitignore')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.fromLiteral('../')).toEqualTypeOf<Path.RelDir>()

    const dynamic = '/x/y.txt' as string
    expectTypeOf(Path.fromLiteral(dynamic)).toEqualTypeOf<Path.Any>()
  })

  it('target constructors are lenient for dirs and statically reject mismatches', () => {
    const decoded = Path.AbsDir.fromLiteral('/releases/v1.2')
    expect(decoded).toEncodeTo('/releases/v1.2/')
    expectTypeOf(decoded).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.RelFile.fromLiteral('./.gitignore')).toEqualTypeOf<Path.RelFile>()

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error absolute literal rejected by a RelFile target
      Path.RelFile.fromLiteral('/abs.txt')
      // @ts-expect-error dir-shaped literal rejected by an AbsFile target
      Path.AbsFile.fromLiteral('/a/b/')
    }
    expect(typeof staticRejections).toBe('function')
  })
})

// ─── traits ───

describe('traits (toString / toJSON / PrimaryKey)', () => {
  it('use the canonical encoded string', () => {
    FastCheck.assert(
      FastCheck.property(PathTesting.Any, (path) => {
        const encoded = encodeAny(path)
        expect(path).toEncodeTo(encoded)
        expect(path.toJSON()).toBe(encoded)
        expect(path[PrimaryKey.symbol]()).toBe(encoded)
      }),
    )
  })
})

// ─── Path.Testing arbitraries ───

const encodedSchemas = [
  ['Segment', Path.Segment, PathTesting.Segment],
  ['FileName', Path.FileName, PathTesting.FileName],
  ['AbsDir', Path.AbsDir, PathTesting.AbsDir],
  ['AbsFile', Path.AbsFile, PathTesting.AbsFile],
  ['RelDir', Path.RelDir, PathTesting.RelDir],
  ['RelFile', Path.RelFile, PathTesting.RelFile],
  ['Any', Path.Any, PathTesting.Any],
] as const

const realisticArbitraries = [
  ['Realistic.Segment', Path.Segment, PathTesting.Realistic.Segment],
  ['Realistic.FileName', Path.FileName, PathTesting.Realistic.FileName],
  ['Realistic.AbsDir', Path.AbsDir, PathTesting.Realistic.AbsDir],
  ['Realistic.AbsFile', Path.AbsFile, PathTesting.Realistic.AbsFile],
  ['Realistic.RelDir', Path.RelDir, PathTesting.Realistic.RelDir],
  ['Realistic.RelFile', Path.RelFile, PathTesting.Realistic.RelFile],
  ['Realistic.Any', Path.Any, PathTesting.Realistic.Any],
] as const

describe('Testing arbitraries', () => {
  it.each([...encodedSchemas, ...realisticArbitraries])(
    '%s encodes 500 sampled values',
    (_, schema, arbitrary) => {
      const encode = S.encodeSync(schema)
      for (const value of FastCheck.sample(arbitrary as FastCheck.Arbitrary<unknown>, 500)) {
        expect(() => encode(value as never)).not.toThrow()
      }
    },
  )

  it.each(encodedSchemas)('%s derives without opaque-filter warnings', (_, schema) => {
    const derivation = S.toArbitrary(schema, { report: true })
    expect(derivation.report.warnings).toEqual([])
  })
})
