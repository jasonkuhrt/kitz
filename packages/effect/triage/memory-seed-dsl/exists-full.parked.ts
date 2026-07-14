import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as Effect from 'effect/Effect'
import * as PlatformFileSystem from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { FileSystem } from '../../file-system/_.js'
import { MemoryFileSystem } from '../../memory-file-system/_.js'
import { Path } from '../../path/_.js'
import { Types } from '../../types/_.js'

describe('FileSystem.exists architecture', () => {
  it('aliases Effect exact service and preserves the requirement until yielded', () => {
    expect(FileSystem.Service).toBe(PlatformFileSystem.FileSystem)
    expectTypeOf(FileSystem.Service).toEqualTypeOf(PlatformFileSystem.FileSystem)
    expectTypeOf(NodeFileSystem.layer).toEqualTypeOf<Layer.Layer<FileSystem.Service>>()
    expectTypeOf(MemoryFileSystem.layer()).toEqualTypeOf<Layer.Layer<FileSystem.Service>>()
    expectTypeOf(MemoryFileSystem.layer({ cwd: '/', entries: [] })).toEqualTypeOf<
      Layer.Layer<FileSystem.Service, MemoryFileSystem.InitializationError>
    >()

    const decoded = Schema.decodeSync(Path.Any)('./present.txt')
    const boundProgram = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.service
      return yield* fileSystem.exists(decoded)
    })

    expectTypeOf(FileSystem.exists('./present.txt')).toEqualTypeOf<
      Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.Service>
    >()
    expectTypeOf(FileSystem.exists(decoded)).toEqualTypeOf<
      Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.Service>
    >()
    expectTypeOf<Effect.Success<typeof boundProgram>>().toEqualTypeOf<boolean>()
    expectTypeOf<Effect.Error<typeof boundProgram>>().toEqualTypeOf<PlatformError.PlatformError>()
    expectTypeOf<Effect.Services<typeof boundProgram>>().toEqualTypeOf<FileSystem.Service>()
  })

  it('types: applies Path literal diagnostics to every public path position', () => {
    expectTypeOf(FileSystem.exists('/workspace/present.txt')).toEqualTypeOf<
      Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.Service>
    >()
    expectTypeOf(FileSystem.exists('/workspace/')).toEqualTypeOf<
      Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.Service>
    >()
    expectTypeOf(FileSystem.exists('../')).toEqualTypeOf<
      Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.Service>
    >()

    type $DynamicParameter = Parameters<typeof FileSystem.exists<string>>[0]
    type $MalformedParameter = Parameters<typeof FileSystem.exists<''>>[0]
    type $DynamicError =
      Types.StaticError<'FileSystem.exists requires a string literal. Use a path schema codec for dynamic strings, or decode the target schema at runtime.'>
    type $MalformedError = Types.StaticError<'The empty string is not a path'>

    expectTypeOf<$DynamicParameter>().toEqualTypeOf<$DynamicError>()
    expectTypeOf<$MalformedParameter>().toEqualTypeOf<$MalformedError>()

    const dynamic = './present.txt' as string
    const staticRejections = () => {
      // @ts-expect-error runtime strings must first be decoded through a Path schema
      FileSystem.exists(dynamic)
      // @ts-expect-error the empty string is not a path
      FileSystem.exists('')
      // @ts-expect-error a directory literal cannot seed a file entry
      MemoryFileSystem.file('/workspace/')
      // @ts-expect-error a memory cwd must be absolute
      MemoryFileSystem.layer({ cwd: './' })
    }
    expect(typeof staticRejections).toBe('function')
  })

  it.scoped('rejects an inconsistent configured memory tree', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Layer.build(
          MemoryFileSystem.layer({
            cwd: '/workspace/',
            entries: [MemoryFileSystem.file('/workspace/present.txt')],
          }),
        ),
      )

      expect(error.reason).toBe('MissingParent')
      expect(error.path).toBe('/workspace/present.txt')
    }),
  )
})

const memoryLayer = MemoryFileSystem.layer({
  cwd: '/workspace/',
  entries: [
    MemoryFileSystem.directory('/workspace/'),
    MemoryFileSystem.file('/workspace/present.txt', 'present'),
  ],
})

interface ExistsFixture {
  readonly present: Path.File
  readonly missing: Path.File
}

const existsLaw = <$Error>(
  name: string,
  provider: Layer.Layer<FileSystem.Service, $Error>,
  fixture: ExistsFixture,
): void => {
  it.layer(provider)(name, (layerIt) => {
    layerIt.effect('agrees across free, yielded, and raw Effect access', () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.service
        const upstream = yield* PlatformFileSystem.FileSystem

        expect(yield* FileSystem.exists(fixture.present)).toBe(true)
        expect(yield* fileSystem.exists(fixture.present)).toBe(true)
        expect(yield* upstream.exists(fixture.present.toString())).toBe(true)
        expect(yield* FileSystem.exists(fixture.missing)).toBe(false)
        expect(yield* fileSystem.exists(fixture.missing)).toBe(false)
        expect(yield* upstream.exists(fixture.missing.toString())).toBe(false)

        const badResource = yield* Effect.flip(FileSystem.exists(fixture.present.asDir))
        expect(badResource.reason._tag).toBe('BadResource')
      }),
    )
  })
}

const memoryPresent = Schema.decodeSync(Path.AbsFile)('/workspace/present.txt')
const memoryMissing = Schema.decodeSync(Path.AbsFile)('/workspace/missing.txt')
const nodePresent = Schema.decodeSync(Path.AbsFile.FromUrl)(new URL(import.meta.url))
const nodeMissing = Path.join(nodePresent.dir, './.__kitz_effect_exists_law_missing__')
const existenceOutcome = Result.match({
  onFailure: (error: PlatformError.PlatformError) => `Failure:${error.reason._tag}`,
  onSuccess: (value: boolean) => `Success:${value}`,
})

existsLaw('MemoryFileSystem exists law', memoryLayer, {
  present: memoryPresent,
  missing: memoryMissing,
})
existsLaw('official NodeFileSystem exists law', NodeFileSystem.layer, {
  present: nodePresent,
  missing: nodeMissing,
})

it.layer(memoryLayer)('MemoryFileSystem raw path semantics', (layerIt) => {
  layerIt.effect('resolves relative POSIX paths against its configured cwd', () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.service
      const upstream = yield* PlatformFileSystem.FileSystem
      const decoded = Schema.decodeSync(Path.RelFile)('./present.txt')

      expect(yield* FileSystem.exists('./present.txt')).toBe(true)
      expect(yield* FileSystem.exists(decoded)).toBe(true)
      expect(yield* fileSystem.exists('./present.txt')).toBe(true)
      expect(yield* upstream.exists('./present.txt')).toBe(true)
      expect(yield* upstream.exists('././present.txt')).toBe(true)
      expect(yield* upstream.exists('../workspace/present.txt')).toBe(true)
      expect(yield* FileSystem.exists('/workspace/')).toBe(true)
      expect(yield* FileSystem.exists('./missing.txt')).toBe(false)
      expect(yield* fileSystem.exists('./missing.txt')).toBe(false)
      expect(yield* upstream.exists('./missing.txt')).toBe(false)
    }),
  )

  layerIt.effect.prop(
    'agrees with the raw Effect service for every decoded Path value',
    [Schema.toArbitrary(Path.Any)] as const,
    ([path]) =>
      Effect.gen(function* () {
        const upstream = yield* PlatformFileSystem.FileSystem
        const typed = yield* Effect.result(FileSystem.exists(path))
        const raw = yield* Effect.result(upstream.exists(path.toString()))

        expect(existenceOutcome(typed)).toBe(existenceOutcome(raw))
      }),
  )
})

it.layer(MemoryFileSystem.layer())('default MemoryFileSystem layer', (layerIt) => {
  layerIt.effect('starts with an accessible root and no files', () =>
    Effect.gen(function* () {
      expect(yield* FileSystem.exists('/')).toBe(true)
      expect(yield* FileSystem.exists('/missing.txt')).toBe(false)
    }),
  )
})
