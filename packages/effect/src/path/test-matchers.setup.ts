import { expect } from 'vite-plus/test'
import * as Path from './__.js'

declare module 'vite-plus/test' {
  interface Matchers<T = any> {
    /** Check if the path is absolute. */
    toBeAbs(): void
    /** Check if the path is relative. */
    toBeRel(): void
    /** Check if the path is a file. */
    toBeFile(): void
    /** Check if the path is a directory. */
    toBeDir(): void
    /** Check if the path is at its root/anchor. */
    toBeRoot(): void
    /** Check if the path is within a given directory. */
    toBeWithinPath(parent: Path.Dir): void
    /** Check if the path encodes to the expected string. */
    toEncodeTo(expected: string): void
  }
}

const display = (received: unknown): string => String(received)

expect.extend({
  toBeAbs(received: unknown) {
    const pass = Path.Abs.is(received)
    const receivedString = display(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be absolute`
          : `Expected ${receivedString} to be absolute`,
    }
  },

  toBeRel(received: unknown) {
    const pass = Path.Rel.is(received)
    const receivedString = display(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be relative`
          : `Expected ${receivedString} to be relative`,
    }
  },

  toBeFile(received: unknown) {
    const pass = Path.File.is(received)
    const receivedString = display(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be a file`
          : `Expected ${receivedString} to be a file`,
    }
  },

  toBeDir(received: unknown) {
    const pass = Path.Dir.is(received)
    const receivedString = display(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be a directory`
          : `Expected ${receivedString} to be a directory`,
    }
  },

  toBeRoot(received: unknown) {
    const pass = Path.Any.is(received) && received.isRoot
    const receivedString = display(received)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be at root`
          : `Expected ${receivedString} to be at root`,
    }
  },

  toBeWithinPath(received: unknown, parent: Path.Dir) {
    const pass =
      Path.Any.is(received) &&
      Path.Dir.is(parent) &&
      Path.isDescendantOf(received as never, parent as never)
    const receivedString = display(received)
    const parentString = display(parent)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${receivedString} not to be within ${parentString}`
          : `Expected ${receivedString} to be within ${parentString}`,
    }
  },

  toEncodeTo(received: unknown, expected: string) {
    const actual = display(received)
    const pass = Path.Any.is(received) && actual === expected

    return {
      pass,
      message: () =>
        pass
          ? `Expected path not to encode to "${expected}"`
          : `Expected path to encode to "${expected}", but got "${actual}"`,
    }
  },
})
