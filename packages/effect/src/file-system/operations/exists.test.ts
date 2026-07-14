import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import { FileSystem } from '../../file-system/_.js'
import { Types } from '../../types/_.js'

describe('FileSystem.exists architecture', () => {
  it('is a Kitz-owned typed service that layers provide directly', () => {
    // The memory layer provides Kitz's own FileSystem tag — not Effect's.
    expectTypeOf(FileSystem.layerMemory()).toEqualTypeOf<Layer.Layer<FileSystem.FileSystem>>()

    // One yield point: the tag yields the typed facade directly.
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
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

// TODO(filesystem-rewiring): the shared exists law — the spec's "backends share
// one conformance suite" — ran only against the deleted hand-rolled Node backend
// (`existsLaw('Node backend exists law', FileSystem.layerNode, …)`, with this test
// module as the on-disk `present` fixture). It is REMOVED, not skipped: its
// subject no longer exists. Restore it once `service.ts` becomes a view over
// Effect's `FileSystem` tag, at which point the same law runs against BOTH
// `NodeFileSystem.layer` (@effect/platform-node) and the memory layer.
// Note the old law asserted `BadResource` for a file addressed as a directory —
// that encoded kitz's hand-rolled errno mapping; re-derive the expected tag from
// Effect's Node backend rather than carrying that assertion over.

it.layer(FileSystem.layerMemory())('default in-memory layer', (layerIt) => {
  layerIt.effect('starts with an accessible root and no files', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      expect(yield* fs.exists('/')).toBe(true)
      expect(yield* fs.exists('/missing.txt')).toBe(false)
    }),
  )
})
