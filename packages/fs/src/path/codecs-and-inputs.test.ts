import { Effect, Exit, Schema as S } from 'effect'
import { describe, expect, test } from 'vitest'
import * as AbsDirCodec from './AbsDir/__.js'
import * as AbsFileCodec from './AbsFile/__.js'
import * as Constants from './constants.js'
import * as Inputs from './inputs.js'
import * as RelDirCodec from './RelDir/__.js'
import * as RelFileCodec from './RelFile/__.js'
import { Schema as PathSchema } from './Schema.js'
import { FileName } from './types/fileName.js'
import * as Segment from './types/segment.js'
import { Segments } from './types/segments.js'

describe('fs path codecs and inputs', () => {
  test('apply constructor defaults and roundtrip member codecs', () => {
    const root = AbsDirCodec.make({})
    const current = RelDirCodec.make({})
    const readme = AbsFileCodec.make({
      segments: ['docs'],
      fileName: FileName.make({ stem: 'README', extension: null }),
    })
    const index = RelFileCodec.make({
      fileName: FileName.make({ stem: 'index', extension: '.ts' }),
    })

    expect(root.toString()).toBe('/')
    expect(root.name).toBe('')
    expect(AbsDirCodec.name(root)).toBe('')
    expect(AbsDirCodec.is(root)).toBe(true)

    expect(current.toString()).toBe('./')
    expect(current.name).toBe('')
    expect(RelDirCodec.is(current)).toBe(true)

    expect(readme.toString()).toBe('/docs/README')
    expect(readme.name).toBe('README')
    expect(AbsFileCodec.is(readme)).toBe(true)

    expect(index.toString()).toBe('./index.ts')
    expect(index.name).toBe('index.ts')
    expect(RelFileCodec.is(index)).toBe(true)

    expect(AbsDirCodec.fromString('/workspace/docs/').toString()).toBe('/workspace/docs/')
    expect(AbsFileCodec.fromString('/workspace/docs/guide.md').name).toBe('guide.md')
    expect(RelDirCodec.fromString('../packages/fs/').toString()).toBe('../packages/fs/')
    expect(RelFileCodec.fromString('../packages/fs/package.json').name).toBe('package.json')
  })

  test('reject invalid member strings with helpful errors', () => {
    expect(() => AbsDirCodec.fromString('./docs/')).toThrow('Absolute paths must start with /')
    expect(() => AbsFileCodec.fromString('/docs/')).toThrow(
      'Expected a file path, got a directory path',
    )
    expect(() => RelDirCodec.fromString('/docs/')).toThrow('Relative paths must not start with /')
    expect(() => RelFileCodec.fromString('./docs/')).toThrow(
      'Expected a file path, got a directory path',
    )
  })

  test('provides directory constants and input normalizers', () => {
    const strictNormalize = Inputs.normalize(PathSchema)
    const dynamicNormalize = Inputs.normalizeDynamic(PathSchema)
    const existing = AbsDirCodec.fromString('/workspace/')

    expect(Constants.stringSeparator).toBe('/')
    expect(Constants.absDirRoot().toString()).toBe('/')
    expect(Constants.relDirCurrent().toString()).toBe('./')
    expect(Constants.relDirParent().toString()).toBe('../')

    const absFile = strictNormalize('/workspace/package.json')
    const relDir = dynamicNormalize('../packages/fs/')

    expect(AbsFileCodec.is(absFile)).toBe(true)
    expect(RelDirCodec.is(relDir)).toBe(true)
    expect(dynamicNormalize(existing)).toBe(existing)
  })

  test('validates filenames, segments, and segment defaults', async () => {
    const readme = S.decodeSync(FileName.String)('README')
    const dotfile = S.decodeSync(FileName.String)('.env')
    const archive = S.decodeSync(FileName.String)('archive.tar.gz')
    const segment = Segment.make('src')
    const decodedSegments = S.decodeSync(Segments)(['src', 'lib'])

    expect(FileName.is(readme)).toBe(true)
    expect(readme.stem).toBe('README')
    expect(readme.extension).toBe(null)
    expect(dotfile.stem).toBe('.env')
    expect(dotfile.extension).toBe(null)
    expect(archive.stem).toBe('archive.tar')
    expect(archive.extension).toBe('.gz')
    expect(S.encodeSync(FileName.String)(archive)).toBe('archive.tar.gz')

    expect(() => S.decodeSync(FileName.String)('src/index.ts')).toThrow(
      'File should be a filename only, not a path',
    )
    expect(() => S.decodeSync(FileName.String)('docs/')).toThrow('File cannot be a directory')
    expect(() => S.decodeSync(FileName.String)('bad.')).toThrow('Invalid file extension')

    expect(segment).toBe('src')
    expect(Segment.encodeSync(segment)).toBe('src')
    expect(await Effect.runPromise(Segment.encode(segment))).toBe('src')
    expect(await Effect.runPromise(Segment.decode('pkg'))).toBe('pkg')
    expect(Segment.decodeSync('lib')).toBe('lib')
    expect(Segment.is(segment)).toBe(true)
    expect(Exit.isFailure(Segment.decodeExit('bad/name'))).toBe(true)
    expect(() => Segment.make('')).toThrow('Path segment cannot be empty')
    expect(() => Segment.decodeSync('bad/name')).toThrow('Path segment cannot contain / or null')

    expect(Segment.Special.current).toBe('.')
    expect(Segment.Special.parent).toBe('..')
    expect(Segment.isSpecial(Segment.Special.current)).toBe(true)
    expect(Segment.isSpecial(segment)).toBe(false)
    expect(Segment.isCurrent(Segment.Special.current)).toBe(true)
    expect(Segment.isParent(Segment.Special.parent)).toBe(true)

    expect(decodedSegments).toEqual(['src', 'lib'])
    expect(AbsDirCodec.make({}).segments).toEqual([])
    expect(RelDirCodec.make({}).segments).toEqual([])
    expect(RelFileCodec.make({ fileName: readme }).segments).toEqual([])
  })
})
