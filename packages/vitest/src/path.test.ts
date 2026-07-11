import { Path } from '@kitz/effect/Path'
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'

const absDir = Path.AbsDir.make({ segments: ['home'].map(Path.segment) })
const absFile = Path.AbsFile.make('/home/index.ts')
const relDir = Path.RelDir.make({ ascent: 0, segments: ['src'].map(Path.segment) })
const relFile = Path.RelFile.make('./src/index.ts')

const messageOf = (assertion: () => void): string => {
  try {
    assertion()
  } catch (error) {
    return (error as Error).message
  }

  throw new Error('Expected assertion to fail')
}

describe('Path matchers', () => {
  describe('toBeAbs', () => {
    it('passes for absolute paths', () => {
      expect(absDir).toBeAbs()
      expect(absFile).toBeAbs()
    })

    it('supports negation', () => {
      expect(relDir).not.toBeAbs()
    })

    it('rejects invalid received values with an absolute message', () => {
      const message = messageOf(() => expect('not a path').toBeAbs())

      expect(message).toContain('toBeAbs')
      expect(message).toContain('to be absolute')
    })
  })

  describe('toBeRel', () => {
    it('passes for relative paths', () => {
      expect(relDir).toBeRel()
      expect(relFile).toBeRel()
    })

    it('supports negation', () => {
      expect(absDir).not.toBeRel()
    })

    it('rejects invalid received values with a relative message', () => {
      const message = messageOf(() => expect('not a path').toBeRel())

      expect(message).toContain('toBeRel')
      expect(message).toContain('to be relative')
    })
  })

  describe('toBeFile', () => {
    it('passes for file paths', () => {
      expect(absFile).toBeFile()
      expect(relFile).toBeFile()
    })

    it('supports negation', () => {
      expect(absDir).not.toBeFile()
    })

    it('rejects invalid received values with a file message', () => {
      const message = messageOf(() => expect('not a path').toBeFile())

      expect(message).toContain('toBeFile')
      expect(message).toContain('to be a file')
    })
  })

  describe('toBeDir', () => {
    it('passes for directory paths', () => {
      expect(absDir).toBeDir()
      expect(relDir).toBeDir()
    })

    it('supports negation', () => {
      expect(relFile).not.toBeDir()
    })

    it('rejects invalid received values with a directory message', () => {
      const message = messageOf(() => expect('not a path').toBeDir())

      expect(message).toContain('toBeDir')
      expect(message).toContain('to be a directory')
    })
  })

  describe('toBeAnchor', () => {
    it('passes for anchor directories', () => {
      expect(Path.AbsDir.anchor).toBeAnchor()
      expect(Path.RelDir.anchor).toBeAnchor()
    })

    it('supports negation', () => {
      expect(absDir).not.toBeAnchor()
    })

    it('rejects invalid received values with an anchor message', () => {
      const message = messageOf(() => expect('not a path').toBeAnchor())

      expect(message).toContain('toBeAnchor')
      expect(message).toContain('to be an anchor')
    })
  })

  describe('toBeWithinPath', () => {
    it('passes for paths within a same-kind parent directory', () => {
      expect(absFile).toBeWithinPath(absDir)
      expect(relFile).toBeWithinPath(relDir)
    })

    it('supports negation', () => {
      expect(Path.AbsFile.make('/var/log.txt')).not.toBeWithinPath(absDir)
    })

    it('rejects invalid received values with a within-path message', () => {
      const message = messageOf(() => expect('not a path').toBeWithinPath(absDir))

      expect(message).toContain('toBeWithinPath')
      expect(message).toContain('to be within')
    })

    it('rejects invalid parent arguments with parent details', () => {
      const message = messageOf(() => expect(absFile).toBeWithinPath('not a dir' as never))

      expect(message).toContain('toBeWithinPath')
      expect(message).toContain('Parent:')
      expect(message).toContain('is not a path directory')
    })

    it('types: correlates the parent group with the received path', () => {
      const assertion = expect(absFile)
      type $Parent = Parameters<typeof assertion.toBeWithinPath>[0]

      // @ts-expect-error RED-PIN: the matcher currently accepts the full Dir union
      expectTypeOf<$Parent>().toEqualTypeOf<Path.AbsDir>()
    })
  })

  describe('toEncodeTo', () => {
    it('passes for the canonical encoded string', () => {
      expect(absFile).toEncodeTo('/home/index.ts')
      expect(relFile).toEncodeTo('./src/index.ts')
    })

    it('supports negation', () => {
      expect(absFile).not.toEncodeTo('/home/other.ts')
    })

    it('rejects invalid received values with an encoding precondition message', () => {
      const message = messageOf(() => expect('not a path').toEncodeTo('./not-a-path'))

      expect(message).toContain('toEncodeTo')
      expect(message).toContain('to be a path before encoding')
      expect(message).toContain('Received:')
    })

    it('rejects invalid expected arguments as a failed encode assertion', () => {
      const message = messageOf(() => expect(absFile).toEncodeTo(123 as never))

      expect(message).toContain('toEncodeTo')
      expect(message).toContain('to encode to')
    })
  })
})
