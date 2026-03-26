import { expect } from 'vitest'
import '../../../test/src/matchers/_.js'
import { Path } from './_.js'

interface PathMatchers<R = unknown> {
  /**
   * Check if the Path is absolute
   */
  toBeAbs(): R

  /**
   * Check if the Path is relative
   */
  toBeRel(): R

  /**
   * Check if the Path is a file
   */
  toBeFile(): R

  /**
   * Check if the Path is a directory
   */
  toBeDir(): R

  /**
   * Check if the Path is at root (no path segments)
   */
  toBeRoot(): R

  /**
   * Check if the Path is within a given directory
   */
  toBeWithin(parent: Path.$Dir): R

  /**
   * Check if the Path encodes to the expected string
   */
  toEncodeTo(expected: string): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends PathMatchers<T> {}
  interface AsymmetricMatchersContaining extends PathMatchers {}
}

expect.extend({
  toBeAbs(received: Path) {
    const pass = Path.$Abs.is(received)
    const receivedStr = Path.toString(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedStr} not to be absolute`
          : `Expected ${receivedStr} to be absolute`,
    }
  },

  toBeRel(received: Path) {
    const pass = Path.$Rel.is(received)
    const receivedStr = Path.toString(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedStr} not to be relative`
          : `Expected ${receivedStr} to be relative`,
    }
  },

  toBeFile(received: Path) {
    const pass = Path.$File.is(received)
    const receivedStr = Path.toString(received)

    return {
      pass,
      message: () =>
        pass ? `Expected ${receivedStr} not to be a file` : `Expected ${receivedStr} to be a file`,
    }
  },

  toBeDir(received: Path) {
    const pass = Path.$Dir.is(received)
    const receivedStr = Path.toString(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedStr} not to be a directory`
          : `Expected ${receivedStr} to be a directory`,
    }
  },

  toBeRoot(received: Path) {
    const pass = Path.States.isRoot(received)
    const receivedStr = Path.toString(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedStr} not to be at root`
          : `Expected ${receivedStr} to be at root`,
    }
  },

  toBeWithin(received: Path, parent: Path.$Dir) {
    // Convert both to absolute for comparison if needed
    const receivedStr = Path.toString(received)
    const parentStr = Path.toString(parent)

    // Check if received path starts with parent path
    // This is a simplified check - you might want to make it more robust
    const receivedSegments = received.segments
    const parentSegments = parent.segments

    const pass =
      parentSegments.every((seg, i) => receivedSegments[i] === seg) &&
      receivedSegments.length > parentSegments.length

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedStr} not to be within ${parentStr}`
          : `Expected ${receivedStr} to be within ${parentStr}`,
    }
  },

  toEncodeTo(received: Path, expected: string) {
    const actual = Path.toString(received)
    const pass = actual === expected

    return {
      pass,
      message: () =>
        pass
          ? `Expected Path not to encode to "${expected}"`
          : `Expected Path to encode to "${expected}", but got "${actual}"`,
    }
  },
})
