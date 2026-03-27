import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import * as AbsDirCodec from './AbsDir/__.js'
import * as AbsFileCodec from './AbsFile/__.js'
import { fromLiteral, fromString } from './operations/fromString.js'
import {
  ensureAbsolute,
  ensureAbsoluteOn,
  ensureAbsoluteWith,
  ensureOptionalAbsolute,
  ensureOptionalAbsoluteOn,
  ensureOptionalAbsoluteWith,
} from './operations/ensureAbsolute.js'
import { extension } from './operations/extension.js'
import { join } from './operations/join.js'
import { name } from './operations/name.js'
import {
  getRelativeSegments,
  getRelativeSegmentsFrom,
  getSharedBase,
  getSharedBaseWith,
  isAncestorOf,
  isAncestorOfPath,
  isDescendantOf,
  isDescendantOfPath,
  isSameSegments,
  isSameSegmentsAs,
  isSegmentsStartsWith,
  isSegmentsStartsWithPrefix,
} from './operations/relationship.js'
import { stem } from './operations/stem.js'
import { toAbs } from './operations/toAbs.js'
import { toDir } from './operations/toDir.js'
import { toFileUrl } from './operations/toFileUrl.js'
import { toRel } from './operations/toRel.js'
import { up } from './operations/up.js'
import * as RelDirCodec from './RelDir/__.js'
import * as RelFileCodec from './RelFile/__.js'
import { isRoot, isSub, isTop } from './states/depth.js'

describe('fs path operations and relationships', () => {
  test('joins, converts, and normalizes path operations', () => {
    const workspace = AbsDirCodec.fromString('/workspace/')
    const packagesDir = RelDirCodec.fromString('./packages/fs/')
    const packageFile = RelFileCodec.fromString('./packages/fs/package.json')
    const climbedFile = RelFileCodec.fromString('../../lib/index.ts')
    const absFile = join(workspace, packageFile)
    const absDir = join(workspace, packagesDir)
    const relJoined = join(RelDirCodec.fromString('../packages/fs/'), climbedFile)

    expect(absFile.toString()).toBe('/workspace/packages/fs/package.json')
    expect(absDir.toString()).toBe('/workspace/packages/fs/')
    expect(relJoined.toString()).toBe('../lib/index.ts')

    expect(toAbs(packageFile).toString()).toBe('/packages/fs/package.json')
    expect(toAbs(packagesDir, workspace).toString()).toBe('/workspace/packages/fs/')
    expect(toRel(absFile, workspace).toString()).toBe('./packages/fs/package.json')
    expect(toDir(absFile).toString()).toBe('/workspace/packages/fs/')

    expect(ensureAbsolute(absFile, workspace)).toBe(absFile)
    expect(ensureAbsolute(packageFile, workspace).toString()).toBe(
      '/workspace/packages/fs/package.json',
    )
    expect(ensureAbsoluteOn(packageFile)(workspace).toString()).toBe(
      '/workspace/packages/fs/package.json',
    )
    expect(ensureAbsoluteWith(workspace)(packagesDir).toString()).toBe('/workspace/packages/fs/')
    expect(ensureOptionalAbsolute(packageFile, workspace)?.toString()).toBe(
      '/workspace/packages/fs/package.json',
    )
    expect(ensureOptionalAbsolute(undefined, workspace)).toBeUndefined()
    expect(ensureOptionalAbsoluteOn(undefined)(workspace)).toBeUndefined()
    expect(ensureOptionalAbsoluteWith(workspace)(undefined)).toBeUndefined()

    expect(fromString('/workspace/package.json').toString()).toBe('/workspace/package.json')
    expect(fromLiteral('./packages/fs/').toString()).toBe('./packages/fs/')
    expect(extension(absFile)).toBe('.json')
    expect(extension(packageFile)).toBe('.json')
    expect(extension(absDir)).toBeNull()
    expect(extension('./packages/fs/')).toBeNull()
    expect(name(absFile)).toBe('package.json')
    expect(name('/')).toBe('')
    expect(stem(absFile)).toBe('package')
    expect(stem(packageFile)).toBe('package')
    expect(stem('/workspace/packages/fs/')).toBe('fs')
    expect(toFileUrl(absFile).href).toBe('file:///workspace/packages/fs/package.json')
    expect(toAbs(packagesDir).toString()).toBe('/packages/fs/')
    expect(toDir(packageFile).toString()).toBe('./packages/fs/')
  })

  test('moves upward through files and directories', () => {
    expect(up('/workspace/packages/fs/').toString()).toBe('/workspace/packages/')
    expect(up('/workspace/packages/fs/package.json').toString()).toBe(
      '/workspace/packages/package.json',
    )
    expect(up('./packages/fs/').toString()).toBe('./packages/')
    expect(up('./packages/fs/package.json').toString()).toBe('./packages/package.json')
    expect(up('./').toString()).toBe('../')
    expect(up('../').toString()).toBe('../../')
  })

  test('computes root and depth states', () => {
    const top = AbsDirCodec.fromString('/workspace/')
    const sub = AbsDirCodec.fromString('/workspace/packages/')

    expect(isRoot('/')).toBe(true)
    expect(isRoot('./')).toBe(true)
    expect(isRoot('../')).toBe(false)
    expect(isTop(top)).toBe(true)
    expect(isTop(sub)).toBe(false)
    expect(isSub(top)).toBe(false)
    expect(isSub(sub)).toBe(true)
  })

  test('tracks descendants, ancestors, relative segments, and shared bases', () => {
    const parent = AbsDirCodec.fromString('/workspace/packages/')
    const childDir = AbsDirCodec.fromString('/workspace/packages/fs/')
    const childFile = AbsFileCodec.fromString('/workspace/packages/fs/package.json')
    const siblingFile = AbsFileCodec.fromString('/workspace/packages/core/package.json')
    const unrelatedFile = AbsFileCodec.fromString('/tmp/report.txt')
    const relParent = RelDirCodec.fromString('../packages/')
    const relChild = RelFileCodec.fromString('../packages/fs/package.json')
    const relOther = RelFileCodec.fromString('../packages/core/package.json')
    const relDifferentBack = RelFileCodec.fromString('../../packages/fs/package.json')

    expect(isDescendantOf(childDir, parent)).toBe(true)
    expect(isDescendantOf(childFile, parent)).toBe(true)
    expect(isDescendantOf(relChild, relParent)).toBe(true)
    expect(isDescendantOf(unrelatedFile, parent)).toBe(false)
    expect(isDescendantOf(relDifferentBack, relParent)).toBe(false)
    expect(isDescendantOfPath(parent)(childFile)).toBe(true)

    expect(isAncestorOf(parent, childFile)).toBe(true)
    expect(isAncestorOf(relParent, relChild)).toBe(true)
    expect(isAncestorOfPath(childFile)(parent)).toBe(true)

    expect(isSegmentsStartsWith(['workspace', 'packages', 'fs'], ['workspace', 'packages'])).toBe(
      true,
    )
    expect(
      isSegmentsStartsWithPrefix(['workspace', 'packages'])(['workspace', 'packages', 'fs']),
    ).toBe(true)

    expect(isSameSegments(childDir, AbsDirCodec.fromString('/workspace/packages/fs/'))).toBe(true)
    expect(isSameSegments(relChild, relOther)).toBe(false)
    expect(isSameSegmentsAs(childDir)(AbsDirCodec.fromString('/workspace/packages/fs/'))).toBe(true)

    expect(getRelativeSegments(childFile, parent)).toEqual(['fs'])
    expect(getRelativeSegmentsFrom(parent)(childFile)).toEqual(['fs'])
    expect(getRelativeSegments(unrelatedFile, parent)).toBeNull()

    const sharedAbs = getSharedBase(childFile, siblingFile)
    expect(Option.isSome(sharedAbs)).toBe(true)
    if (Option.isSome(sharedAbs)) {
      expect(sharedAbs.value.toString()).toBe('/workspace/packages/')
    }

    const sharedRel = getSharedBaseWith(relChild)(relOther)
    expect(Option.isSome(sharedRel)).toBe(true)
    if (Option.isSome(sharedRel)) {
      expect(sharedRel.value.toString()).toBe('../packages/')
    }

    expect(Option.isNone(getSharedBase(childFile, unrelatedFile))).toBe(true)
  })
})
