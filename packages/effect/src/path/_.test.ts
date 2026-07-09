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
import {
  Config,
  ConfigProvider,
  Effect,
  Equal,
  Layer,
  Option,
  pipe,
  Result,
  Schema as S,
} from 'effect'
import * as PrimaryKey from 'effect/PrimaryKey'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'

// ─── shared generators & helpers ───

// Arbitraries derive on demand from the model schemas (S.toArbitrary is
// memoized); Realistic variants are the models' own variant statics.
const arb = {
  Segment: S.toArbitrary(Path.Segment),
  FileName: S.toArbitrary(Path.FileName),
  AbsDir: S.toArbitrary(Path.AbsDir),
  AbsFile: S.toArbitrary(Path.AbsFile),
  RelDir: S.toArbitrary(Path.RelDir),
  RelFile: S.toArbitrary(Path.RelFile),
  Any: S.toArbitrary(Path.Any),
  Realistic: {
    Segment: S.toArbitrary(Path.Segment.Realistic),
    FileName: S.toArbitrary(Path.FileName.Realistic),
    AbsDir: S.toArbitrary(Path.AbsDir.Realistic),
    AbsFile: S.toArbitrary(Path.AbsFile.Realistic),
    RelDir: S.toArbitrary(Path.RelDir.Realistic),
    RelFile: S.toArbitrary(Path.RelFile.Realistic),
    Any: S.toArbitrary(Path.Any.Realistic),
  },
} as const

const abs = FastCheck.oneof(arb.AbsDir, arb.AbsFile)
const dir = FastCheck.oneof(arb.AbsDir, arb.RelDir)
const rel = FastCheck.oneof(arb.RelDir, arb.RelFile)
const file = FastCheck.oneof(arb.AbsFile, arb.RelFile)
const relDirAscent0 = FastCheck.array(arb.Segment, { maxLength: 6 }).map((segments) =>
  Path.RelDir.make({ ascent: 0, segments }),
)
const relFileAscent0 = FastCheck.record({
  segments: FastCheck.array(arb.Segment, { maxLength: 6 }),
  fileName: arb.FileName,
}).map((input) =>
  Path.RelFile.make({
    dir: Path.RelDir.make({ ascent: 0, segments: input.segments }),
    fileName: input.fileName,
  }),
)
const relAscent0 = FastCheck.oneof(relDirAscent0, relFileAscent0)
const nonEmptyRelAscent0 = FastCheck.oneof(
  FastCheck.array(arb.Segment, { minLength: 1, maxLength: 6 }).map((segments) =>
    Path.RelDir.make({ ascent: 0, segments }),
  ),
  relFileAscent0,
)

const encodeAny = S.encodeSync(Path.Any)
const extension = (value: string) => S.decodeSync(Path.Extension.Extension)(value)
const fileName = (value: string) => S.decodeSync(Path.FileName)(value)
const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0)

const someAbsFile = Path.AbsFile.make({
  dir: Path.AbsDir.make({ segments: ['home', 'src'].map(Path.segment) }),
  fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
})
const someAbsDir = Path.AbsDir.make({ segments: ['home'].map(Path.segment) })
const someRelFile = Path.RelFile.make({
  dir: Path.RelDir.make({ ascent: 0, segments: ['src'].map(Path.segment) }),
  fileName: Path.FileName.make({ stem: 'index', extension: Option.some('.ts') }),
})
const someRelDir = Path.RelDir.make({ ascent: 0, segments: ['src'].map(Path.segment) })

// ─── codec: the string ⇄ value contract, parameterized over every model ───

const codecCases = [
  ['AbsDir', Path.AbsDir, arb.AbsDir],
  ['AbsFile', Path.AbsFile, arb.AbsFile],
  ['RelDir', Path.RelDir, arb.RelDir],
  ['RelFile', Path.RelFile, arb.RelFile],
  ['Abs', Path.Abs, FastCheck.oneof(arb.AbsDir, arb.AbsFile)],
  ['Rel', Path.Rel, FastCheck.oneof(arb.RelDir, arb.RelFile)],
  ['Dir', Path.Dir, FastCheck.oneof(arb.AbsDir, arb.RelDir)],
  ['File', Path.File, FastCheck.oneof(arb.AbsFile, arb.RelFile)],
  ['Any', Path.Any, arb.Any],
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
      FastCheck.property(arb.Any, (path) => {
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

    expectTypeOf((someAbsDir as Path.Dir).parent).toEqualTypeOf<Path.AbsDir | Path.RelDir>()
    // @ts-expect-error parent is dir-only — absent from the Any union
    void anyPath.parent
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
    expectTypeOf(someRelFile.stem).toEqualTypeOf<string>()
    expectTypeOf(someAbsFile.extension).toEqualTypeOf<Option.Option<Path.Extension.Extension>>()
    expectTypeOf(someRelFile.extension).toEqualTypeOf<Option.Option<Path.Extension.Extension>>()
    expectTypeOf(someAbsDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
    expectTypeOf(someRelDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
  })

  it('types: getters distribute over the File/Dir unions', () => {
    expectTypeOf((someAbsFile as Path.File).stem).toEqualTypeOf<string>()
    expectTypeOf((someAbsFile as Path.File).extension).toEqualTypeOf<
      Option.Option<Path.Extension.Extension>
    >()
    expectTypeOf((someAbsDir as Path.Dir).name).toEqualTypeOf<Option.Option<Path.Segment>>()
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
    expectTypeOf((someAbsFile as Path.File).dir).toEqualTypeOf<Path.AbsDir | Path.RelDir>()
  })
})

// ─── getters: parent ───

describe('.parent', () => {
  it('handles roots and segment-less relatives', () => {
    const root = Path.AbsDir.make({ segments: [] })
    expect(root).toBeAnchor()
    expect(root.parent).toEqual(root)

    FastCheck.assert(
      FastCheck.property(FastCheck.integer({ min: 0, max: 8 }), (ascent) => {
        const relRoot = Path.RelDir.make({ ascent, segments: [] })
        expect(relRoot.parent.ascent).toBe(ascent + 1)
        expect(relRoot.parent.segments).toEqual([])
      }),
    )
  })

  it('types: dir-only; files answer "up" with .dir', () => {
    expectTypeOf(someAbsDir.parent).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(someRelDir.parent).toEqualTypeOf<Path.RelDir>()
    // @ts-expect-error parent does not exist on files — the dirname false friend is a compile error
    void someAbsFile.parent
    // @ts-expect-error parent does not exist on files — the dirname false friend is a compile error
    void someRelFile.parent
    // @ts-expect-error isRoot does not exist on files — derive through file.dir.isAnchor
    void someAbsFile.isRoot
    // @ts-expect-error isRoot does not exist on files — derive through file.dir.isAnchor
    void someRelFile.isRoot
  })
})

// ─── getters: ancestors ───

const iterateAbsParents = <P extends Path.AbsDir | Path.AbsFile>(
  path: P,
): readonly Path.AbsDir[] => {
  if (Path.AbsDir.is(path) && path.isAnchor) return []

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

// ─── getters: isAnchor / depth ───

describe('.isAnchor / .depth', () => {
  it('isAnchor is true exactly for segment-less, ascent-0 dirs', () => {
    FastCheck.assert(
      FastCheck.property(dir, (path) => {
        const ascent = Path.RelDir.is(path) ? path.ascent : 0
        expect(path.isAnchor).toBe(path.segments.length === 0 && ascent === 0)
      }),
    )
  })

  it('files derive anchor checks from their containing dir', () => {
    FastCheck.assert(
      FastCheck.property(file, (path) => {
        const ascent = Path.RelFile.is(path) ? path.ascent : 0
        expect(path.dir.isAnchor).toBe(path.segments.length === 0 && ascent === 0)
      }),
    )
  })

  it('anchor statics are the named dir anchors', () => {
    expect(Path.AbsDir.anchor.isAnchor).toBe(true)
    expect(Path.RelDir.anchor.isAnchor).toBe(true)
    expect(Path.RelDir.make({ ascent: 2, segments: [] }).isAnchor).toBe(false)
  })

  it('RelDir.anchor is the join identity for dirs', () => {
    FastCheck.assert(
      FastCheck.property(dir, (d) => {
        expect(Equal.equals(Path.join(d, Path.RelDir.anchor), d)).toBe(true)
      }),
    )
  })

  it('depth is the segment count (files exclude the filename)', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, (path) => {
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

// ─── alternate codecs: FromUrl ───

describe('FromUrl', () => {
  it('types: fileUrl is a URL on abs variants', () => {
    expectTypeOf(someAbsFile.fileUrl).toEqualTypeOf<URL>()
    expectTypeOf(someAbsDir.fileUrl).toEqualTypeOf<URL>()
  })

  it('decodes the ESM file and dir URL idioms', () => {
    const thisFile = S.decodeSync(Path.AbsFile.FromUrl)(new URL(import.meta.url))
    const thisDir = S.decodeSync(Path.AbsDir.FromUrl)(new URL('.', import.meta.url))

    expect(thisFile).toBeAbs()
    expect(thisFile).toBeFile()
    expect(thisDir).toBeAbs()
    expect(thisDir).toBeDir()
  })

  it('round trips URL encoding for generated absolute values', () => {
    FastCheck.assert(
      FastCheck.property(arb.AbsFile, (path) => {
        const encoded = S.encodeSync(Path.AbsFile.FromUrl)(path)
        const decoded = S.decodeSync(Path.AbsFile.FromUrl)(encoded)

        expect(encoded).toBeInstanceOf(URL)
        expect(Equal.equals(decoded, path)).toBe(true)
      }),
    )

    FastCheck.assert(
      FastCheck.property(arb.AbsDir, (path) => {
        const encoded = S.encodeSync(Path.AbsDir.FromUrl)(path)
        const decoded = S.decodeSync(Path.AbsDir.FromUrl)(encoded)

        expect(encoded).toBeInstanceOf(URL)
        expect(Equal.equals(decoded, path)).toBe(true)
      }),
    )
  })

  it('rejects non-file URLs and non-local file URL hosts', () => {
    expect(
      Result.isFailure(S.decodeResult(Path.AbsFile.FromUrl)(new URL('https://example.com/a'))),
    ).toBe(true)
    expect(
      Result.isFailure(S.decodeResult(Path.AbsDir.FromUrl)(new URL('file://example.com/a/'))),
    ).toBe(true)
  })

  it('pins target-specific trailing-slash behavior', () => {
    expect(S.decodeSync(Path.AbsDir.FromUrl)(new URL('file:///releases/v1.2'))).toEncodeTo(
      '/releases/v1.2/',
    )
    expect(Result.isFailure(S.decodeResult(Path.AbsFile.FromUrl)(new URL('file:///tmp/a/')))).toBe(
      true,
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
    const decoded = Path.AbsFile.is(path)
      ? S.decodeSync(Path.AbsFile.FromUrl)(path.fileUrl)
      : S.decodeSync(Path.AbsDir.FromUrl)(path.fileUrl)

    expect(Equal.equals(decoded, path)).toBe(true)
  })
})

// ─── alternate codecs: FromStruct ───

describe('FromStruct', () => {
  it.each([
    ['AbsFile', Path.AbsFile.FromStruct, arb.AbsFile],
    ['AbsDir', Path.AbsDir.FromStruct, arb.AbsDir],
    ['RelFile', Path.RelFile.FromStruct, arb.RelFile],
    ['RelDir', Path.RelDir.FromStruct, arb.RelDir],
  ] as const)('%s encode/decode roundtrip', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)
    const decode = S.decodeSync(schema)

    FastCheck.assert(
      FastCheck.property(arbitrary as FastCheck.Arbitrary<never>, (path) => {
        expect(Equal.equals(decode(encode(path)), path)).toBe(true)
      }),
    )
  })

  it('rejects invalid wire data', () => {
    expect(
      Result.isFailure(S.decodeUnknownResult(Path.AbsDir.FromStruct)({ segments: ['ok', ''] })),
    ).toBe(true)
    expect(
      Result.isFailure(S.decodeUnknownResult(Path.RelDir.FromStruct)({ ascent: -1, segments: [] })),
    ).toBe(true)
  })

  it('types: encoded side is the flat primitive wire struct', () => {
    expectTypeOf<S.Codec.Encoded<typeof Path.AbsFile.FromStruct>>().toEqualTypeOf<{
      readonly segments: readonly string[]
      readonly fileName: string
    }>()
    expectTypeOf<S.Codec.Encoded<typeof Path.RelFile.FromStruct>>().toEqualTypeOf<{
      readonly ascent: number
      readonly segments: readonly string[]
      readonly fileName: string
    }>()
    expectTypeOf<S.Codec.Encoded<typeof Path.AbsDir.FromStruct>>().toEqualTypeOf<{
      readonly segments: readonly string[]
    }>()
    expectTypeOf<S.Codec.Encoded<typeof Path.RelDir.FromStruct>>().toEqualTypeOf<{
      readonly ascent: number
      readonly segments: readonly string[]
    }>()
  })
})

// ─── service: Cwd ───

describe('Cwd', () => {
  it('yields the provided cwd from a test layer', async () => {
    const actual = await Effect.gen(function* () {
      return yield* Path.Cwd
    }).pipe(Effect.provide(Layer.succeed(Path.Cwd)(someAbsDir)), Effect.runPromise)

    expect(actual).toEqual(someAbsDir)
  })

  it('process layer snapshots process.cwd as AbsDir', async () => {
    const actual = await Effect.gen(function* () {
      return yield* Path.Cwd
    }).pipe(Effect.provide(Path.Cwd.layer), Effect.runPromise)

    expect(actual).toBeAbs()
    expect(actual).toBeDir()
    expect(actual.toString()).toBe(`${process.cwd()}/`)
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
    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.Join<Path.AbsDir, Path.RelDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.Join<Path.AbsDir, Path.RelFile>>().toEqualTypeOf<Path.AbsFile>()
    expectTypeOf<Path.Join<Path.RelDir, Path.RelDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.Join<Path.RelDir, Path.RelFile>>().toEqualTypeOf<Path.RelFile>()
  })
})

// ─── operation: relativeTo ───

describe('relativeTo', () => {
  it('join(base, relativeTo(abs, base)) returns the original absolute path', () => {
    FastCheck.assert(
      FastCheck.property(abs, arb.AbsDir, (path, base) => {
        expect(Path.join(base, Path.relativeTo(path, base))).toEqual(path)
      }),
    )
  })

  it('relative relativeTo is Some exactly when target ascent is not shallower than base ascent', () => {
    FastCheck.assert(
      FastCheck.property(rel, arb.RelDir, (target, base) => {
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
    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.RelativeTo<Path.AbsDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.RelativeTo<Path.AbsFile>>().toEqualTypeOf<Path.RelFile>()
    expectTypeOf<Path.RelativeTo<Path.RelDir>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.RelativeTo<Path.RelFile>>().toEqualTypeOf<Path.RelFile>()
  })
})

// ─── operation: ensureAbs ───

describe('ensureAbs', () => {
  it('is idempotent and reference-preserving for absolute inputs', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, arb.AbsDir, (path, base) => {
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
    // the exported type utility agrees cell-by-cell
    expectTypeOf<Path.EnsureAbs<Path.AbsDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.EnsureAbs<Path.AbsFile>>().toEqualTypeOf<Path.AbsFile>()
    expectTypeOf<Path.EnsureAbs<Path.RelDir>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.EnsureAbs<Path.RelFile>>().toEqualTypeOf<Path.AbsFile>()
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

  it('is strict for directory identity', () => {
    FastCheck.assert(
      FastCheck.property(dir, (path) => {
        expect(Path.isDescendantOf(path, path)).toBe(false)
      }),
    )
  })

  it('keeps files directly inside their containing dir as descendants', () => {
    FastCheck.assert(
      FastCheck.property(file, (path) => {
        expect(Path.isDescendantOf(path, path.dir)).toBe(true)
      }),
    )
  })

  it('keeps different-ascent pure relatives strict', () => {
    expect(
      Path.isDescendantOf(
        Path.RelDir.make({ ascent: 1, segments: [] }),
        Path.RelDir.make({ ascent: 2, segments: [] }),
      ),
    ).toBe(true)
  })
})

// ─── operation: isWithin ───

describe('isWithin', () => {
  it.each([
    [
      './a within ./',
      Path.RelDir.make({ ascent: 0, segments: ['a'].map(Path.segment) }),
      Path.RelDir.anchor,
      true,
    ],
    [
      './a within ../',
      Path.RelDir.make({ ascent: 0, segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 1, segments: [] }),
      true,
    ],
    [
      '../x within ../../',
      Path.RelDir.make({ ascent: 1, segments: ['x'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 2, segments: [] }),
      true,
    ],
    [
      '../a within ../b',
      Path.RelDir.make({ ascent: 1, segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 1, segments: ['b'].map(Path.segment) }),
      false,
    ],
    ['../../ within ./', Path.RelDir.make({ ascent: 2, segments: [] }), Path.RelDir.anchor, false],
    [
      '/apps/ within /',
      Path.AbsDir.make({ segments: ['apps'].map(Path.segment) }),
      Path.AbsDir.anchor,
      true,
    ],
    [
      '/apps/ within /libs/',
      Path.AbsDir.make({ segments: ['apps'].map(Path.segment) }),
      Path.AbsDir.make({ segments: ['libs'].map(Path.segment) }),
      false,
    ],
  ] as const)('%s', (_, child, parent, expected) => {
    expect(Path.isWithin(child as never, parent as never)).toBe(expected)
  })

  it('is descendant-or-directory-identity inclusive containment', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, dir, (child, parent) => {
        expect(Path.isWithin(child as never, parent as never)).toBe(
          Path.isDescendantOf(child as never, parent as never) ||
            (Path.Dir.is(child) && Equal.equals(child, parent)),
        )
      }),
    )
  })

  it('includes directory identity', () => {
    FastCheck.assert(
      FastCheck.property(dir, (path) => {
        expect(Path.isWithin(path, path)).toBe(true)
      }),
    )
  })
})

// ─── operation: isAncestorOf ───

describe('isAncestorOf', () => {
  it('is the inverse of isDescendantOf', () => {
    FastCheck.assert(
      FastCheck.property(dir, arb.Any, (base, child) => {
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

// ─── operation: commonAncestor ───

describe('commonAncestor', () => {
  it('is total and returns an inclusive ancestor of same-group paths', () => {
    FastCheck.assert(
      FastCheck.property(abs, abs, (a, b) => {
        const ab = Path.Abs.commonAncestor(a, b)
        const ba = Path.Abs.commonAncestor(b, a)

        expect(ab).toEqual(ba)
        expect(Path.isWithin(a, ab)).toBe(true)
        expect(Path.isWithin(b, ab)).toBe(true)
      }),
    )

    FastCheck.assert(
      FastCheck.property(rel, rel, (a, b) => {
        const ab = Path.Rel.commonAncestor(a, b)
        const ba = Path.Rel.commonAncestor(b, a)

        expect(ab).toEqual(ba)
        expect(Path.isWithin(a, ab)).toBe(true)
        expect(Path.isWithin(b, ab)).toBe(true)
      }),
    )
  })

  it('uses the anchor and pure-ascent floor when no named prefix exists', () => {
    const absShared = Path.Abs.commonAncestor(
      Path.AbsFile.mk('/apps/app.ts'),
      Path.AbsFile.mk('/libs/lib.ts'),
    )
    const relShared = Path.Rel.commonAncestor(
      Path.RelDir.make({ ascent: 0, segments: ['a'].map(Path.segment) }),
      Path.RelDir.make({ ascent: 2, segments: [] }),
    )

    expect(Equal.equals(absShared, Path.AbsDir.anchor)).toBe(true)
    expect(Equal.equals(relShared, Path.RelDir.make({ ascent: 2, segments: [] }))).toBe(true)
  })

  it('returns the deepest self ancestor for same-path inputs', () => {
    FastCheck.assert(
      FastCheck.property(abs, (path) => {
        const expected = Path.AbsFile.is(path) ? path.dir : path

        expect(Equal.equals(Path.Abs.commonAncestor(path, path), expected)).toBe(true)
      }),
    )

    FastCheck.assert(
      FastCheck.property(rel, (path) => {
        const expected = Path.RelFile.is(path) ? path.dir : path

        expect(Equal.equals(Path.Rel.commonAncestor(path, path), expected)).toBe(true)
      }),
    )
  })

  it('types: data-first and data-last return the group directory type', () => {
    expectTypeOf(Path.Abs.commonAncestor(someAbsFile, someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Rel.commonAncestor(someRelDir)(someRelFile)).toEqualTypeOf<Path.RelDir>()

    const staticRejections = () => {
      // @ts-expect-error Abs.commonAncestor only accepts absolute paths
      Path.Abs.commonAncestor(someAbsFile, someRelDir)
      // @ts-expect-error Rel.commonAncestor only accepts relative paths
      Path.Rel.commonAncestor(someAbsDir)(someRelFile)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

// ─── operation: order ───

describe('order', () => {
  it('is reflexive, antisymmetric, transitive, and agrees with Equal', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, arb.Any, arb.Any, (a, b, c) => {
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

// ─── model statics: setParts ───

describe('setParts', () => {
  it('name axis preserves AbsFile variant and directory', () => {
    FastCheck.assert(
      FastCheck.property(arb.AbsFile, arb.FileName, (f, name) => {
        const renamed = Path.AbsFile.setParts(f, { name })

        expect(renamed._tag).toBe('AbsFile')
        expect(renamed.dir).toEqual(f.dir)
        expect(renamed.fileName).toEqual(name)
      }),
    )
  })

  it('name axis preserves RelFile variant and directory', () => {
    FastCheck.assert(
      FastCheck.property(arb.RelFile, arb.FileName, (f, name) => {
        const renamed = Path.RelFile.setParts(f, { name })

        expect(renamed._tag).toBe('RelFile')
        expect(renamed.dir).toEqual(f.dir)
        expect(renamed.fileName).toEqual(name)
      }),
    )
  })

  it('stem and extension axes rebuild the filename', () => {
    const archive = Path.AbsFile.make({
      dir: Path.AbsDir.make({ segments: ['tmp'].map(Path.segment) }),
      fileName: fileName('archive.tar.gz'),
    })
    const readme = Path.RelFile.make({
      dir: Path.RelDir.make({ ascent: 1, segments: ['docs'].map(Path.segment) }),
      fileName: fileName('README.md'),
    })

    expect(Path.AbsFile.setParts(archive, { stem: 'bundle' }).name).toBe('bundle.gz')
    expect(Path.AbsFile.setParts(archive, { extension: Option.none() }).name).toBe('archive.tar')
    expect(Path.RelFile.setParts(readme, { extension: extension('.json') }).name).toBe(
      'README.json',
    )
  })

  it('addExtension is the stem-plus-extension setParts idiom', () => {
    const archive = Path.AbsFile.make({
      dir: Path.AbsDir.anchor,
      fileName: fileName('archive.tar'),
    })

    expect(
      Path.AbsFile.setParts(archive, { stem: archive.name, extension: extension('.gz') }).name,
    ).toBe('archive.tar.gz')
  })

  it('dir axis moves AbsFile without changing the filename', () => {
    FastCheck.assert(
      FastCheck.property(arb.AbsFile, arb.AbsDir, (f, dir) => {
        const moved = Path.AbsFile.setParts(f, { dir })

        expect(moved.segments).toEqual(dir.segments)
        expect(moved.fileName).toEqual(f.fileName)
      }),
    )
  })

  it('dir axis replaces RelFile ascent and segments without changing the filename', () => {
    FastCheck.assert(
      FastCheck.property(arb.RelFile, arb.RelDir, (f, dir) => {
        const moved = Path.RelFile.setParts(f, { dir })

        expect(moved.ascent).toBe(dir.ascent)
        expect(moved.segments).toEqual(dir.segments)
        expect(moved.fileName).toEqual(f.fileName)
      }),
    )
  })

  it('dir and filename axes compose in one call', () => {
    const targetDir = Path.RelDir.make({
      ascent: 2,
      segments: ['pkg'].map(Path.segment),
    })
    const moved = Path.RelFile.setParts(someRelFile, { dir: targetDir, stem: 'renamed' })

    expect(moved.dir).toEqual(targetDir)
    expect(moved.name).toBe('renamed.ts')
  })

  it('supports curried pipe form', () => {
    expect(pipe(someAbsFile, Path.AbsFile.setParts({ stem: 'x' })).name).toBe('x.ts')
  })

  it('empty parts rebuild an Equal-equal path', () => {
    FastCheck.assert(
      FastCheck.property(file, (f) => {
        const rebuilt = Path.AbsFile.is(f)
          ? Path.AbsFile.setParts(f, {})
          : Path.RelFile.setParts(f, {})

        expect(Equal.equals(rebuilt, f)).toBe(true)
      }),
    )
  })

  it('types: payloads reject mixed filename modes and opposite-anchor dirs', () => {
    expectTypeOf(Path.AbsFile.setParts(someAbsFile, { stem: 'x' })).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.RelFile.setParts(someRelFile, { stem: 'x' })).toEqualTypeOf<Path.RelFile>()

    const staticRejections = () => {
      // @ts-expect-error name and stem are mutually exclusive
      Path.AbsFile.setParts(someAbsFile, { name: fileName('next.ts'), stem: 'next' })
      // @ts-expect-error RelFile dir axis only accepts RelDir
      Path.RelFile.setParts(someRelFile, { dir: someAbsDir })
      // @ts-expect-error AbsFile dir axis only accepts AbsDir
      Path.AbsFile.setParts(someAbsFile, { dir: someRelDir })
    }
    expect(typeof staticRejections).toBe('function')
  })
})

// ─── operation: withName ───

describe('withName', () => {
  it('renames the final directory segment', () => {
    expect(Path.withName(someAbsDir, Path.segment('var'))).toEqual(
      Option.some(Path.AbsDir.make({ segments: ['var'].map(Path.segment) })),
    )
    expect(pipe(someRelDir, Path.withName(Path.segment('lib')))).toEqual(
      Option.some(Path.RelDir.make({ ascent: 0, segments: ['lib'].map(Path.segment) })),
    )
  })

  it('returns None for root and segment-less relative dirs', () => {
    expect(Path.withName(Path.AbsDir.make({ segments: [] }), Path.segment('root'))).toEqual(
      Option.none(),
    )
    expect(
      Path.withName(Path.RelDir.make({ ascent: 2, segments: [] }), Path.segment('src')),
    ).toEqual(Option.none())
  })
})

// ─── literals: mk + per-target constructors ───

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

describe('mk', () => {
  it.each(unionLiteralCases)('mk(%s) agrees with union decode', (input) => {
    expect(Path.mk(input)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
  })

  it('types: literal shapes infer precise variants; dynamic strings are rejected', () => {
    expectTypeOf(Path.mk('/home/u/f.txt')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('./.gitignore')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('../')).toEqualTypeOf<Path.RelDir>()

    const dynamic = '/x/y.txt' as string

    // Type-only: never executed, so the @ts-expect-error rejection cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected by Path.mk; decode runtime strings through a schema
      Path.mk(dynamic)
    }
    expect(typeof staticRejections).toBe('function')

    // the exported type utility: shapes not exercised through the function above
    expectTypeOf<Path.FromLiteral<'/'>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.FromLiteral<'../x'>>().toEqualTypeOf<Path.RelFile>()
    expectTypeOf<Path.FromLiteral<'x.'>>().toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.FromLiteral<string>>().toEqualTypeOf<Path.Any>()
  })

  it('target constructors are lenient for dirs and statically reject mismatches', () => {
    const decoded = Path.AbsDir.mk('/releases/v1.2')
    expect(decoded).toEncodeTo('/releases/v1.2/')
    expectTypeOf(decoded).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.RelFile.mk('./.gitignore')).toEqualTypeOf<Path.RelFile>()

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error absolute literal rejected by a RelFile target
      Path.RelFile.mk('/abs.txt')
      // @ts-expect-error dir-shaped literal rejected by an AbsFile target
      Path.AbsFile.mk('/a/b/')
      // @ts-expect-error relative literal rejected by an AbsFile target
      Path.AbsFile.mk('./x')
      // @ts-expect-error absolute literal rejected by a RelDir target
      Path.RelDir.mk('/x/')
      // @ts-expect-error dynamic strings rejected by literal-only target constructors
      Path.AbsDir.mk('/x/' as string)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

// ─── Config integration ───

describe('Config integration', () => {
  it('Config.schema decodes typed paths straight from a provider', () => {
    const provider = ConfigProvider.fromUnknown({
      CACHE_DIR: '/var/cache',
      ENTRY: './src/index.ts',
    })

    const cacheDir = Effect.runSync(Config.schema(Path.AbsDir, 'CACHE_DIR').parse(provider))
    expect(cacheDir).toEncodeTo('/var/cache/')
    expectTypeOf(cacheDir).toEqualTypeOf<Path.AbsDir>()

    const entry = Effect.runSync(Config.schema(Path.RelFile, 'ENTRY').parse(provider))
    expect(entry).toEncodeTo('./src/index.ts')
    expectTypeOf(entry).toEqualTypeOf<Path.RelFile>()
  })
})

// ─── traits ───

describe('traits (toString / toJSON / PrimaryKey)', () => {
  it('use the canonical encoded string', () => {
    FastCheck.assert(
      FastCheck.property(arb.Any, (path) => {
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
  ['Segment', Path.Segment, arb.Segment],
  ['FileName', Path.FileName, arb.FileName],
  ['AbsDir', Path.AbsDir, arb.AbsDir],
  ['AbsFile', Path.AbsFile, arb.AbsFile],
  ['RelDir', Path.RelDir, arb.RelDir],
  ['RelFile', Path.RelFile, arb.RelFile],
  ['Any', Path.Any, arb.Any],
] as const

const realisticArbitraries = [
  ['Realistic.Segment', Path.Segment, arb.Realistic.Segment],
  ['Realistic.FileName', Path.FileName, arb.Realistic.FileName],
  ['Realistic.AbsDir', Path.AbsDir, arb.Realistic.AbsDir],
  ['Realistic.AbsFile', Path.AbsFile, arb.Realistic.AbsFile],
  ['Realistic.RelDir', Path.RelDir, arb.Realistic.RelDir],
  ['Realistic.RelFile', Path.RelFile, arb.Realistic.RelFile],
  ['Realistic.Any', Path.Any, arb.Realistic.Any],
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

describe('Segment.Realistic', () => {
  it('accepts the same set as Segment; generation is biased toward realistic names', () => {
    const samples = FastCheck.sample(S.toArbitrary(Path.Segment.Realistic), {
      numRuns: 500,
      seed: 42,
    })
    for (const value of samples) expect(S.decodeSync(Path.Segment)(value)).toBe(value)
    const realistic = samples.filter((s) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(s))
    // candidate weight 20 vs base weight 1 → expected fraction ≈ 20/21
    expect(realistic.length / samples.length).toBeGreaterThan(0.85)
  })
})
