import { NodeFileSystem } from '@effect/platform-node'
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as Effect from 'effect/Effect'
import * as FileSystemEffect from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import * as Schema from 'effect/Schema'
import { FileSystem } from '../../file-system/_.js'
import { Path } from '../../path/_.js'
import { Types } from '../../types/_.js'

describe('FileSystem.exists architecture', () => {
  it('dispatches to the native Effect service — no second Context identity', () => {
    // Kitz's tag IS effect's tag. The memory layer therefore provides the
    // upstream service, making it a drop-in for NodeFileSystem.layer: any other
    // Effect code in the program observes the same filesystem.
    expectTypeOf(FileSystem.Service).toEqualTypeOf<typeof FileSystemEffect.FileSystem>()
    expectTypeOf(FileSystem.layerMemory()).toEqualTypeOf<Layer.Layer<FileSystemEffect.FileSystem>>()

    // The typed facade is a view, not a tag: it is yielded from an Effect, and
    // the program's only requirement is the upstream FileSystem.
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem.service
      return yield* fs.exists('./present.txt')
    })
    expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<boolean>()
    expectTypeOf<Effect.Error<typeof program>>().toEqualTypeOf<PlatformError.PlatformError>()
    expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<FileSystemEffect.FileSystem>()
  })

  it('types: the top-level operation carries the requirement in its context channel', () => {
    const program = FileSystem.exists('./present.txt')
    expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<boolean>()
    expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<FileSystemEffect.FileSystem>()
  })

  it('types: the exists method applies Path literal diagnostics', () => {
    const check = (fs: FileSystem.Api) => {
      const dynamic = './present.txt' as string

      expectTypeOf(fs.exists('/workspace/present.txt')).toEqualTypeOf<
        Effect.Effect<boolean, PlatformError.PlatformError>
      >()
      expectTypeOf(fs.exists('/workspace/')).toEqualTypeOf<
        Effect.Effect<boolean, PlatformError.PlatformError>
      >()
      expectTypeOf(fs.exists('../')).toEqualTypeOf<
        Effect.Effect<boolean, PlatformError.PlatformError>
      >()

      type $DynamicParameter = Parameters<typeof fs.exists<string>>[0]
      type $MalformedParameter = Parameters<typeof fs.exists<''>>[0]
      type $DynamicError =
        Types.StaticError<'FileSystem.exists requires a string literal. Use a path schema codec for dynamic strings, or decode the target schema at runtime.'>
      type $MalformedError = Types.StaticError<'The empty string is not a path'>

      expectTypeOf<$DynamicParameter>().toEqualTypeOf<$DynamicError>()
      expectTypeOf<$MalformedParameter>().toEqualTypeOf<$MalformedError>()

      // @ts-expect-error runtime strings must first be decoded through a Path schema
      void fs.exists(dynamic)
      // @ts-expect-error the empty string is not a path
      void fs.exists('')
    }
    expect(typeof check).toBe('function')
  })
})

// The shared exists law: any backend providing effect's FileSystem agrees. Both
// providers are now the same kind of thing — a `Layer<FileSystemEffect.FileSystem>` —
// which is what makes one suite able to hold them.
//
// `BadResource` for a file addressed as a directory is the agreed answer, not a
// kitz invention: effect's Node backend maps ENOTDIR (and EISDIR, ELOOP) to
// BadResource in platform-node-shared/internal/utils.js, and the memory graph's
// walker returns the same reason for a non-directory component.
//
// Only Node runs the seeded parts: the memory backend starts empty and its seed
// DSL is parked (packages/effect/triage/memory-seed-dsl), so until write ops land
// it is covered by the empty-layer test below.
interface ExistsFixture {
  readonly present: Path.File
  readonly missing: Path.File
}

const existsLaw = <$Error>(
  name: string,
  provider: Layer.Layer<FileSystemEffect.FileSystem, $Error>,
  fixture: ExistsFixture,
): void => {
  it.layer(provider)(name, (layerIt) => {
    layerIt.effect('accessible → true, missing → false, non-directory → BadResource', () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.service

        expect(yield* fs.exists(fixture.present)).toBe(true)
        expect(yield* fs.exists(fixture.missing)).toBe(false)

        const badResource = yield* Effect.flip(fs.exists(fixture.present.asDir))
        expect(badResource.reason._tag).toBe('BadResource')
      }),
    )
  })
}

const nodePresent = Schema.decodeSync(Path.AbsFile.FromUrl)(new URL(import.meta.url))
const nodeMissing = Path.join(nodePresent.dir, './.__kitz_effect_exists_law_missing__')

existsLaw('Node backend exists law', NodeFileSystem.layer, {
  present: nodePresent,
  missing: nodeMissing,
})

it.layer(FileSystem.layerMemory())('default in-memory layer', (layerIt) => {
  layerIt.effect('starts with an accessible root and no files', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.service
      expect(yield* fs.exists('/')).toBe(true)
      expect(yield* fs.exists('/missing.txt')).toBe(false)
    }),
  )

  // The distinction from `FileSystem.makeNoop`, which answers `NotFound` for
  // every unimplemented slot — a truthful answer to a different question.
  layerIt.effect('an unimplemented primitive fails as Unknown, never NotFound', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.Service
      const error = yield* Effect.flip(fs.readFile('/missing.txt'))
      expect(error.reason._tag).toBe('Unknown')
    }),
  )
})
