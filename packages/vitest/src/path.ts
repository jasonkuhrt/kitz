import * as Path from '@kitz/effect/Path'
import { expect, type MatcherState } from 'vite-plus/test'

type MatcherResult = { pass: boolean; message: () => string }

// Vite+ documents upstream Vitest augmentation as the target, but this repo
// forbids a direct Vitest dependency so Vite+ owns the single Vitest copy. We
// augment the shim identity this repo resolves; revisit if Vite+ ships a
// types-only augmentation entry point.
declare module 'vite-plus/test' {
  // Augmentation of @vitest/expect's `Matchers<T = any>` — the type parameter
  // list must match the upstream declaration exactly for merging (TS2428).
  interface Matchers<T = any> {
    /** Check if the path is absolute. */
    toBeAbs(): void
    /** Check if the path is relative. */
    toBeRel(): void
    /** Check if the path is a file. */
    toBeFile(): void
    /** Check if the path is a directory. */
    toBeDir(): void
    /** Check if the path is an anchor directory. */
    toBeAnchor(): void
    /** Check if the path is within a given directory. */
    toBeWithinPath(parent: Path.Dir): void
    /** Check if the path encodes to the expected string. */
    toEncodeTo(expected: string): void
  }
}

type Message = {
  matcherName: string
  receivedLabel?: string
  expectedLabel?: string
  positive: string
  negative: string
  details?: string | undefined
}

const message = (state: MatcherState, parts: Message): (() => string) => {
  const hint = state.utils.matcherHint(
    parts.matcherName,
    parts.receivedLabel ?? 'received',
    parts.expectedLabel,
    { isNot: state.isNot },
  )
  const body = state.isNot ? parts.negative : parts.positive

  return () => [hint, '', body, parts.details].filter(Boolean).join('\n')
}

const receivedLine = (state: MatcherState, received: unknown): string =>
  `Received: ${state.utils.printReceived(received)}`

const passResult = (state: MatcherState, pass: boolean, parts: Message): MatcherResult => ({
  pass,
  message: message(state, parts),
})

const isWithin = (received: Path.Any, parent: Path.Dir): boolean => {
  if (Path.Abs.is(received) && Path.AbsDir.is(parent)) {
    return Path.isWithin(received, parent)
  }

  if (Path.Rel.is(received) && Path.RelDir.is(parent)) {
    return Path.isWithin(received, parent)
  }

  return false
}

const matchers = {
  toBeAbs(this: MatcherState, received: unknown): MatcherResult {
    const pass = Path.Abs.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeAbs',
      positive: `Expected ${printed} to be absolute`,
      negative: `Expected ${printed} not to be absolute`,
    })
  },

  toBeRel(this: MatcherState, received: unknown): MatcherResult {
    const pass = Path.Rel.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeRel',
      positive: `Expected ${printed} to be relative`,
      negative: `Expected ${printed} not to be relative`,
    })
  },

  toBeFile(this: MatcherState, received: unknown): MatcherResult {
    const pass = Path.File.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeFile',
      positive: `Expected ${printed} to be a file`,
      negative: `Expected ${printed} not to be a file`,
    })
  },

  toBeDir(this: MatcherState, received: unknown): MatcherResult {
    const pass = Path.Dir.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeDir',
      positive: `Expected ${printed} to be a directory`,
      negative: `Expected ${printed} not to be a directory`,
    })
  },

  toBeAnchor(this: MatcherState, received: unknown): MatcherResult {
    const pass = Path.Dir.is(received) && received.isAnchor
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeAnchor',
      positive: `Expected ${printed} to be an anchor`,
      negative: `Expected ${printed} not to be an anchor`,
    })
  },

  toBeWithinPath(this: MatcherState, received: unknown, parent: Path.Dir): MatcherResult {
    const pass = Path.Any.is(received) && Path.Dir.is(parent) && isWithin(received, parent)
    const printed = this.utils.printReceived(received)
    const parentPrinted = this.utils.printExpected(parent)

    return passResult(this, pass, {
      matcherName: 'toBeWithinPath',
      expectedLabel: 'parent',
      positive: `Expected ${printed} to be within ${parentPrinted}`,
      negative: `Expected ${printed} not to be within ${parentPrinted}`,
      details: Path.Dir.is(parent)
        ? undefined
        : `Parent: ${this.utils.printExpected(parent)} is not a path directory`,
    })
  },

  toEncodeTo(this: MatcherState, received: unknown, expected: string): MatcherResult {
    const actual = Path.Any.is(received) ? received.toString() : undefined
    const pass = actual === expected
    const diff = actual === undefined ? undefined : this.utils.diff(expected, actual)
    const fallback =
      actual === undefined
        ? receivedLine(this, received)
        : [
            `Expected: ${this.utils.printExpected(expected)}`,
            `Received: ${this.utils.printReceived(actual)}`,
          ].join('\n')

    return passResult(this, pass, {
      matcherName: 'toEncodeTo',
      expectedLabel: 'expected',
      positive:
        actual === undefined
          ? `Expected received value to be a path before encoding`
          : `Expected path to encode to ${this.utils.printExpected(expected)}`,
      negative: `Expected path not to encode to ${this.utils.printExpected(expected)}`,
      details: diff ?? fallback,
    })
  },
}

/** Register path-aware matchers for `@kitz/effect` values on the per-worker `expect`. */
export const addMatchers = (): void => {
  expect.extend(matchers)
}
