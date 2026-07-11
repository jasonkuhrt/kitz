/**
 * Path index suite — models, codecs, decode-side literal classification,
 * unions, traits, and integration, organized by feature.
 *
 * Operation suites are colocated in operations/<name>.test.ts. Type-level and
 * value-level assertions remain together at each feature's test locus.
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
import * as LiteralCore from './core/literal.js'
import { Types } from '../types/_.js'
import { analyze } from './analyzer.js'
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

const encodeAny = S.encodeSync(Path.Any)
const extension = (value: string) => S.decodeSync(Path.Extension)(value)
const fileName = (value: string) => S.decodeSync(Path.FileName)(value)

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
  ['./.env.local', 'RelFile', './.env.local'],
  ['/a/b', 'AbsFile', '/a/b'],
  ['x.', 'RelFile', './x.'],
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

// ─── path grammar: type ⇄ value agreement ───

// Law: any edit that changes the runtime or type-level path grammar must change the other.
const acceptedLiterals = [
  ['.', 'RelDir'],
  ['./', 'RelDir'],
  ['..', 'RelDir'],
  ['../', 'RelDir'],
  ['/', 'AbsDir'],
  ['/.', 'AbsDir'],
  ['/..', 'AbsDir'],
  ['/../', 'AbsDir'],
  ['./..', 'RelDir'],
  ['../.', 'RelDir'],
  ['a', 'RelFile'],
  ['a/', 'RelDir'],
  ['/a', 'AbsFile'],
  ['/a/', 'AbsDir'],
  ['./a', 'RelFile'],
  ['./a/', 'RelDir'],
  ['../a', 'RelFile'],
  ['a/../b', 'RelFile'],
  ['a/..', 'RelDir'],
  ['/a/..', 'AbsDir'],
  ['/a/../../b', 'AbsFile'],
  ['a/./b', 'RelFile'],
  ['.hidden', 'RelFile'],
  ['/etc/.hidden', 'AbsFile'],
  ['a.', 'RelFile'],
  ['/a.', 'AbsFile'],
  ['a..', 'RelFile'],
  ['name.tar.gz', 'RelFile'],
  ['a b/c d.txt', 'RelFile'],
  ['café/naïve.txt', 'RelFile'],
  [' ', 'RelFile'],
  ['a//b', 'RelFile'],
  ['/a//b', 'AbsFile'],
  ['a///b/', 'RelDir'],
  ['//x', 'AbsFile'],
  ['a/b/c/d/e/f/g/h/i/j/file.ts', 'RelFile'],
  ['./src/', 'RelDir'],
  ['/usr/local/bin/node', 'AbsFile'],
] as const

describe('path type⇄value grammar agreement', () => {
  it.each(acceptedLiterals)('%s classifies as %s at runtime', (literal, expected) => {
    expect(S.decodeSync(Path.Any)(literal)._tag).toBe(expected)
  })

  it('classifies every accepted literal identically at the type level', () => {
    expectTypeOf(Path.mk('.')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('./')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/.')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/..')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/../')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('./..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../.')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/a')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('/a/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('./a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('./a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a/../b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a/..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/a/..')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/a/../../b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a/./b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('.hidden')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/etc/.hidden')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a.')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a.')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a..')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('name.tar.gz')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a b/c d.txt')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('café/naïve.txt')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk(' ')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a//b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a//b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a///b/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('//x')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a/b/c/d/e/f/g/h/i/j/file.ts')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/usr/local/bin/node')).toEqualTypeOf<Path.AbsFile>()
  })

  it('rejects the empty string at both levels', () => {
    expect(() => S.decodeSync(Path.Any)('')).toThrow()

    const staticRejection = () => {
      // @ts-expect-error the empty string is not a path literal
      Path.mk('')
    }
    expect(typeof staticRejection).toBe('function')
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
    expectTypeOf(someAbsFile.extension).toEqualTypeOf<Option.Option<Path.Extension>>()
    expectTypeOf(someRelFile.extension).toEqualTypeOf<Option.Option<Path.Extension>>()
    expectTypeOf(someAbsDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
    expectTypeOf(someRelDir.name).toEqualTypeOf<Option.Option<Path.Segment>>()
  })

  it('types: getters distribute over the File/Dir unions', () => {
    expectTypeOf((someAbsFile as Path.File).stem).toEqualTypeOf<string>()
    expectTypeOf((someAbsFile as Path.File).extension).toEqualTypeOf<
      Option.Option<Path.Extension>
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

const iterateAbsParents = <$P extends Path.AbsDir | Path.AbsFile>(
  path: $P,
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

// ─── operation: commonAncestor ───

describe('commonAncestor', () => {
  it('literal duality obeys the desugar law for both group statics and call shapes', () => {
    const absA = S.decodeSync(Path.Abs)('/workspace/src/index.ts')
    const absB = S.decodeSync(Path.Abs)('/workspace/test/')
    const absExpected = Path.Abs.commonAncestor(absA, absB)

    expect(absExpected).toEncodeTo('/workspace/')
    expect(Path.Abs.commonAncestor('/workspace/src/index.ts', absB)).toEqual(absExpected)
    expect(Path.Abs.commonAncestor(absA, '/workspace/test/')).toEqual(absExpected)
    expect(Path.Abs.commonAncestor('/workspace/src/index.ts', '/workspace/test/')).toEqual(
      absExpected,
    )
    expect(Path.Abs.commonAncestor('/workspace/test/')(absA)).toEqual(absExpected)
    expect(Path.Abs.commonAncestor(absB)('/workspace/src/index.ts')).toEqual(absExpected)

    const relA = S.decodeSync(Path.Rel)('../workspace/src/index.ts')
    const relB = S.decodeSync(Path.Rel)('../workspace/test/')
    const relExpected = Path.Rel.commonAncestor(relA, relB)

    expect(relExpected).toEncodeTo('../workspace/')
    expect(Path.Rel.commonAncestor('../workspace/src/index.ts', relB)).toEqual(relExpected)
    expect(Path.Rel.commonAncestor(relA, '../workspace/test/')).toEqual(relExpected)
    expect(Path.Rel.commonAncestor('../workspace/src/index.ts', '../workspace/test/')).toEqual(
      relExpected,
    )
    expect(Path.Rel.commonAncestor('../workspace/test/')(relA)).toEqual(relExpected)
    expect(Path.Rel.commonAncestor(relB)('../workspace/src/index.ts')).toEqual(relExpected)
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

  it('types: literal/value matrices return the group directory and reject invalid worlds', () => {
    expectTypeOf(Path.Abs.commonAncestor('/a/file.ts', '/a/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Abs.commonAncestor('/a/file.ts', someAbsDir)).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Abs.commonAncestor(someAbsFile, '/a/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Abs.commonAncestor(someAbsFile, someAbsDir)).toEqualTypeOf<Path.AbsDir>()

    expectTypeOf(Path.Rel.commonAncestor('./a/file.ts', './a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.Rel.commonAncestor('./a/file.ts', someRelDir)).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.Rel.commonAncestor(someRelFile, './a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.Rel.commonAncestor(someRelFile, someRelDir)).toEqualTypeOf<Path.RelDir>()

    expectTypeOf(Path.Abs.commonAncestor('/a/')('/a/file.ts')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Abs.commonAncestor(someAbsDir)('/a/file.ts')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.Rel.commonAncestor('./a/')(someRelFile)).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.Rel.commonAncestor(someRelDir)(someRelFile)).toEqualTypeOf<Path.RelDir>()

    const dynamic = '/a/' as string

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected at the first data-first position
      Path.Abs.commonAncestor(dynamic, someAbsDir)
      // @ts-expect-error dynamic strings are rejected at the second data-first position
      Path.Abs.commonAncestor(someAbsFile, dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last outer position
      Path.Abs.commonAncestor(dynamic)
      // @ts-expect-error dynamic strings are rejected at the data-last inner position
      Path.Abs.commonAncestor(someAbsDir)(dynamic)
      // @ts-expect-error invalid literals are rejected at the first position
      Path.Rel.commonAncestor('//', someRelDir)
      // @ts-expect-error invalid literals are rejected at the second position
      Path.Rel.commonAncestor(someRelFile, '//')
      // @ts-expect-error absolute statics reject relative literals at the first position
      Path.Abs.commonAncestor('./a/file.ts', '/a/')
      // @ts-expect-error absolute statics reject relative literals at the second position
      Path.Abs.commonAncestor('/a/file.ts', './a/')
      // @ts-expect-error relative statics reject absolute literals at the data-last outer position
      Path.Rel.commonAncestor('/a/')
      // @ts-expect-error relative statics reject absolute literals at the data-last inner position
      Path.Rel.commonAncestor('./a/')('/a/file.ts')
      // @ts-expect-error Abs.commonAncestor rejects relative path values
      Path.Abs.commonAncestor(someAbsFile, someRelDir)
      // @ts-expect-error Rel.commonAncestor rejects absolute path values
      Path.Rel.commonAncestor(someAbsDir)(someRelFile)
    }
    expect(typeof staticRejections).toBe('function')
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

    const dynamicSubject = '/tmp/file.txt' as string
    const dynamicDir = '/tmp/' as string
    const dynamicName = 'next.ts' as string

    const staticRejections = () => {
      // @ts-expect-error name and stem are mutually exclusive
      Path.AbsFile.setParts(someAbsFile, { name: fileName('next.ts'), stem: 'next' })
      // @ts-expect-error RelFile dir axis only accepts RelDir
      Path.RelFile.setParts(someRelFile, { dir: someAbsDir })
      // @ts-expect-error AbsFile dir axis only accepts AbsDir
      Path.AbsFile.setParts(someAbsFile, { dir: someRelDir })
      // @ts-expect-error dynamic subjects must be decoded through AbsFile
      Path.AbsFile.setParts(dynamicSubject, { stem: 'next' })
      // @ts-expect-error dynamic dirs must be decoded through AbsDir
      Path.AbsFile.setParts(someAbsFile, { dir: dynamicDir })
      // @ts-expect-error dynamic names must be decoded through FileName
      Path.AbsFile.setParts(someAbsFile, { name: dynamicName })
      // @ts-expect-error relative setParts rejects an absolute dir literal
      Path.RelFile.setParts(someRelFile, { dir: '/tmp/' })
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

// ─── DX stress findings — red suite (2026-07-11) ───
// Each block encodes the DESIRED behavior for a captured finding. Runtime
// assertions are genuinely red where runtime behavior is wrong; type-level
// bugs are pinned with @ts-expect-error directives that the fix makes unused
// (TS2578), forcing their removal in the fix commit.

describe('finding 1: dot-only compound literals are directories at the type level', () => {
  it('runtime decode classifies dot-only compound literals as directories', () => {
    expect(S.decodeSync(Path.Any)('/.')._tag).toBe('AbsDir')
    expect(S.decodeSync(Path.Any)('/..')._tag).toBe('AbsDir')
    expect(S.decodeSync(Path.Any)('./..')._tag).toBe('RelDir')
    expect(S.decodeSync(Path.Any)('../.')._tag).toBe('RelDir')
  })
})

describe('finding 2: setParts validates dynamic filename parts', () => {
  const subject = S.decodeSync(Path.AbsFile)('/home/user/a.txt')
  it('rejects a stem containing a separator', () => {
    expect(() => Path.AbsFile.setParts(subject, { stem: 'evil/name' })).toThrow()
  })
  it('rejects a dotless extension', () => {
    expect(() => Path.AbsFile.setParts(subject, { extension: 'zip' })).toThrow()
  })
  it('rejects a dotless extension wrapped in Option', () => {
    expect(() => Path.AbsFile.setParts(subject, { extension: Option.some('zip') })).toThrow()
  })
  it('rejects an extension containing a separator', () => {
    expect(() => Path.AbsFile.setParts(subject, { extension: '.a/b' })).toThrow()
  })
  it('FileName.make rejects a stem containing a separator', () => {
    expect(() => Path.FileName.make({ stem: 'evil/name', extension: Option.none() })).toThrow()
  })
})

describe('finding 3: repeated separators collapse at the type level like runtime', () => {
  it('runtime decode classifies repeated separators after normalization', () => {
    expect(S.decodeSync(Path.Any)('a//b')._tag).toBe('RelFile')
    expect(S.decodeSync(Path.Any)('/a//b')._tag).toBe('AbsFile')
    expect(S.decodeSync(Path.Any)('a///b/')._tag).toBe('RelDir')
  })
})

describe('finding 5: trailing-dot names are files (POSIX), not directories', () => {
  it('decodes trailing-dot names as extensionless files', () => {
    expect(S.decodeSync(Path.Any)('a.')._tag).toBe('RelFile')
    expect(S.decodeSync(Path.Any)('/etc/a.')._tag).toBe('AbsFile')
    expect(S.encodeSync(Path.Any)(S.decodeSync(Path.Any)('a.'))).toBe('./a.')
  })
})

describe('finding 6: the empty string is not a path', () => {
  it('rejects empty string at decode', () => {
    expect(() => S.decodeSync(Path.Any)('')).toThrow()
  })
})

describe('finding 9: Extension is a first-class model with a literal constructor', () => {
  it('Extension.mk constructs from a literal', () => {
    const ext = Path.Extension.mk('.zip')
    expect(String(ext)).toBe('.zip')
  })
})

// ─── type⇄value message SOT (audit 2026-07-11) ───

describe('shared message texts across type and value levels', () => {
  it('empty-string rejection uses one message text at both levels', () => {
    // Runtime text (already the unified form):
    try {
      S.decodeSync(Path.Any)('')
      expect.unreachable()
    } catch (e) {
      expect(String(e)).toContain('The empty string is not a path')
      expect(String(e)).not.toContain('not a path literal')
    }
    type $Expected = Types.StaticError<'The empty string is not a path'>
    expectTypeOf<LiteralCore.ErrorMalformedLiteral<''>>().toEqualTypeOf<$Expected>()
  })
})

// ─── Audit round 3 — RED suite (2026-07-11) ───

describe('audit round 3: filename and path text validity', () => {
  it('rejects NUL in bare filenames and path filenames', () => {
    expect(Result.isFailure(S.decodeResult(Path.FileName)('a\0b'))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.AbsFile)('/tmp/a\0b'))).toBe(true)
  })

  it('represents nested segment failures in the Schema result channel', () => {
    const decode = () => S.decodeResult(Path.RelFile)('./a\0b/file.txt')

    expect(decode).not.toThrow()
    expect(Result.isFailure(decode())).toBe(true)
    expect(
      Effect.runSync(
        S.decodeEffect(Path.RelFile)('./a\0b/file.txt').pipe(
          Effect.match({ onFailure: () => 'failure', onSuccess: () => 'success' }),
        ),
      ),
    ).toBe('failure')
  })

  it('rejects traversal and multi-component syntax as a bare filename', () => {
    expect(Result.isFailure(S.decodeResult(Path.FileName)('../evil'))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.FileName)('./evil'))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.FileName)('safe/../evil'))).toBe(true)

    const subject = S.decodeSync(Path.AbsFile)('/tmp/file.txt')
    expect(() => Path.AbsFile.setParts(subject, { stem: 'safe/../evil' })).toThrow()
  })

  it('classifies normalized-empty traversal-only input as a directory without a hint', () => {
    expect(analyze('./..')._tag).toBe('dir')
  })

  it('bounds relative ascent at the path grammar maximum', () => {
    const atMaximum = S.decodeUnknownResult(Path.RelDir.FromStruct)({
      ascent: 4096,
      segments: [],
    })
    expect(Result.isSuccess(atMaximum)).toBe(true)
    expect(
      Result.isFailure(
        S.decodeUnknownResult(Path.RelDir.FromStruct)({ ascent: 4097, segments: [] }),
      ),
    ).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.RelDir)('../'.repeat(4097)))).toBe(true)

    if (Result.isSuccess(atMaximum)) {
      expect(() => atMaximum.success.toString()).not.toThrow()
      expect(() => atMaximum.success.parent).not.toThrow()
      expect(atMaximum.success.parent.ascent).toBe(4096)
    }
  })

  it('rejects ill-formed Unicode across component and path codecs', () => {
    const loneSurrogate = '\ud800'
    expect(loneSurrogate.isWellFormed()).toBe(false)
    expect(Result.isFailure(S.decodeResult(Path.Segment)(loneSurrogate))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.FileName)(`a${loneSurrogate}`))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.AbsDir)(`/${loneSurrogate}/`))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.AbsFile)(`/${loneSurrogate}`))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.RelDir)(`./${loneSurrogate}/`))).toBe(true)
    expect(Result.isFailure(S.decodeResult(Path.RelFile)(`./${loneSurrogate}`))).toBe(true)

    const astral = S.decodeSync(Path.AbsFile)('/tmp/😀.txt')
    expect(() => astral.fileUrl).not.toThrow()
  })
})

describe('audit round 3: Protocol', () => {
  it('rejects an encoded protocol without the :// suffix', () => {
    expect(() => S.decodeSync(Path.Protocol)('filexxx')).toThrow()
  })

  it('exports the protocol schema directly', () => {
    expect(S.decodeSync(Path.Protocol)('file://')).toBe('file')
  })
})

describe('audit round 3: literal component producer contract', () => {
  it('exposes literal constructors on Segment, Extension, and FileName', () => {
    const segment = Path.Segment.mk('src')
    const extensionValue = Path.Extension.mk('.ts')
    const name = Path.FileName.mk('manifest.json')

    expectTypeOf(segment).toEqualTypeOf<Path.Segment>()
    expectTypeOf(extensionValue).toEqualTypeOf<Path.Extension>()
    expectTypeOf(name).toEqualTypeOf<Path.FileName>()
    expectTypeOf<
      import('./models/FileName.js').FileNameLiteralGuard<'manifest.json'>
    >().toEqualTypeOf<'manifest.json'>()
    expect(Path.Segment.is(segment)).toBe(true)
    expect(Path.Extension.is(extensionValue)).toBe(true)
    expect(Path.FileName.is(name)).toBe(true)
    expect(Path.Segment.make('lib')).toBe(Path.Segment.mk('lib'))
    expect(Path.Extension.make('.json')).toBe(Path.Extension.mk('.json'))
    expect(
      Path.FileName.make({ stem: 'manifest', extension: Option.some(extensionValue) }),
    ).toEqual(Path.FileName.mk('manifest.ts'))

    const dynamic = 'dynamic' as string
    const staticRejections = () => {
      // @ts-expect-error literal component constructors reject dynamic strings
      Path.Segment.mk(dynamic)
      // @ts-expect-error literal component constructors reject dynamic strings
      Path.Extension.mk(dynamic)
      // @ts-expect-error literal component constructors reject dynamic strings
      Path.FileName.mk(dynamic)
      // @ts-expect-error filename literals cannot contain separators
      Path.FileName.mk('bad/name')
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('audit round 3: setParts literal duality', () => {
  it('accepts literals for the subject, dir, and name in both call shapes', () => {
    const direct = Path.AbsFile.setParts('/tmp/original.txt', {
      dir: '/var',
      name: 'manifest.json',
    })
    const setRelParts = Path.RelFile.setParts({ dir: '../out', name: 'manifest.json' })
    const curried = setRelParts('./original.txt')
    const expectedDirect = Path.AbsFile.setParts(S.decodeSync(Path.AbsFile)('/tmp/original.txt'), {
      dir: S.decodeSync(Path.AbsDir)('/var'),
      name: S.decodeSync(Path.FileName)('manifest.json'),
    })
    const expectedCurried = Path.RelFile.setParts(S.decodeSync(Path.RelFile)('./original.txt'), {
      dir: S.decodeSync(Path.RelDir)('../out'),
      name: S.decodeSync(Path.FileName)('manifest.json'),
    })

    expect(direct).toEncodeTo('/var/manifest.json')
    expect(curried).toEncodeTo('../out/manifest.json')
    expect(direct).toEqual(expectedDirect)
    expect(curried).toEqual(expectedCurried)
    expectTypeOf(direct).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(curried).toEqualTypeOf<Path.RelFile>()
  })
})

describe('audit round 3: Analyzer ownership', () => {
  it('keeps analyzer machinery off the public Path namespace', () => {
    const staticRejection = () => {
      // @ts-expect-error Analyzer is internal codec machinery
      void Path.Analyzer
    }

    expect(typeof staticRejection).toBe('function')
    expect(Object.hasOwn(Path, 'Analyzer')).toBe(false)
  })
})
