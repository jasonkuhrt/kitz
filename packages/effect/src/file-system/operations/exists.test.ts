import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as Effect from 'effect/Effect'
import * as PlatformFileSystem from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import * as Schema from 'effect/Schema'
import { FileSystem } from '../../file-system/_.js'
import { Path } from '../../path/_.js'
import { Types } from '../../types/_.js'

describe('FileSystem.exists architecture', () => {
  it('re-exports Effect exact service and exposes a typed method facade', () => {
    // `FileSystem.FileSystem` is Effect's own tag, re-exported unchanged, so
    // official platform layers and the memory layer satisfy the same requirement.
    expect(FileSystem.FileSystem).toBe(PlatformFileSystem.FileSystem)
    expectTypeOf(FileSystem.FileSystem).toEqualTypeOf(PlatformFileSystem.FileSystem)
    expectTypeOf(NodeFileSystem.layer).toEqualTypeOf<Layer.Layer<FileSystem.FileSystem>>()
    expectTypeOf(FileSystem.layerMemory()).toEqualTypeOf<Layer.Layer<FileSystem.FileSystem>>()

    // The typed facade requires the service until provided, then binds methods.
    expectTypeOf(FileSystem.service).toEqualTypeOf<
      Effect.Effect<FileSystem.Api, never, FileSystem.FileSystem>
    >()

    const program = Effect.gen(function* () {
      const fs = yield* FileSystem.service
      return yield* fs.exists('./present.txt')
    })
    expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<boolean>()
    expectTypeOf<Effect.Error<typeof program>>().toEqualTypeOf<PlatformError.PlatformError>()
    expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<FileSystem.FileSystem>()
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

// The shared exists law: any backend providing the service must agree between
// the typed facade and the raw Effect service. Seeding a non-trivial fixture
// goes through the filesystem's own operations, so the memory backend can only
// run this law once write ops land; until then it uses a real on-disk fixture
// via the official Node layer. (The seeded memory variant is parked under
// packages/effect/triage/memory-seed-dsl.)
interface ExistsFixture {
  readonly present: Path.File
  readonly missing: Path.File
}

const existsLaw = <$Error>(
  name: string,
  provider: Layer.Layer<FileSystem.FileSystem, $Error>,
  fixture: ExistsFixture,
): void => {
  it.layer(provider)(name, (layerIt) => {
    layerIt.effect('agrees between the typed facade and raw Effect access', () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.service
        const upstream = yield* PlatformFileSystem.FileSystem

        expect(yield* fs.exists(fixture.present)).toBe(true)
        expect(yield* upstream.exists(fixture.present.toString())).toBe(true)
        expect(yield* fs.exists(fixture.missing)).toBe(false)
        expect(yield* upstream.exists(fixture.missing.toString())).toBe(false)

        const badResource = yield* Effect.flip(fs.exists(fixture.present.asDir))
        expect(badResource.reason._tag).toBe('BadResource')
      }),
    )
  })
}

const nodePresent = Schema.decodeSync(Path.AbsFile.FromUrl)(new URL(import.meta.url))
const nodeMissing = Path.join(nodePresent.dir, './.__kitz_effect_exists_law_missing__')

existsLaw('official NodeFileSystem exists law', NodeFileSystem.layer, {
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
})
