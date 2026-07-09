import * as Kitz from '@kitz/effect/Path'
import { expect, type MatcherState } from 'vite-plus/test'

type MatcherResult = { pass: boolean; message: () => string }

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
    toBeWithinPath(parent: Kitz.Path.Dir): void
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

const isWithin = (received: Kitz.Path.Any, parent: Kitz.Path.Dir): boolean => {
  if (Kitz.Path.Abs.is(received) && Kitz.Path.AbsDir.is(parent)) {
    return Kitz.Path.isWithin(received, parent)
  }

  if (Kitz.Path.Rel.is(received) && Kitz.Path.RelDir.is(parent)) {
    return Kitz.Path.isWithin(received, parent)
  }

  return false
}

const matchers = {
  toBeAbs(this: MatcherState, received: unknown): MatcherResult {
    const pass = Kitz.Path.Abs.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeAbs',
      positive: `Expected ${printed} to be absolute`,
      negative: `Expected ${printed} not to be absolute`,
    })
  },

  toBeRel(this: MatcherState, received: unknown): MatcherResult {
    const pass = Kitz.Path.Rel.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeRel',
      positive: `Expected ${printed} to be relative`,
      negative: `Expected ${printed} not to be relative`,
    })
  },

  toBeFile(this: MatcherState, received: unknown): MatcherResult {
    const pass = Kitz.Path.File.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeFile',
      positive: `Expected ${printed} to be a file`,
      negative: `Expected ${printed} not to be a file`,
    })
  },

  toBeDir(this: MatcherState, received: unknown): MatcherResult {
    const pass = Kitz.Path.Dir.is(received)
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeDir',
      positive: `Expected ${printed} to be a directory`,
      negative: `Expected ${printed} not to be a directory`,
    })
  },

  toBeRoot(this: MatcherState, received: unknown): MatcherResult {
    const pass = Kitz.Path.Dir.is(received) && received.isAnchor
    const printed = this.utils.printReceived(received)

    return passResult(this, pass, {
      matcherName: 'toBeRoot',
      positive: `Expected ${printed} to be at root`,
      negative: `Expected ${printed} not to be at root`,
    })
  },

  toBeWithinPath(this: MatcherState, received: unknown, parent: Kitz.Path.Dir): MatcherResult {
    const pass =
      Kitz.Path.Any.is(received) && Kitz.Path.Dir.is(parent) && isWithin(received, parent)
    const printed = this.utils.printReceived(received)
    const parentPrinted = this.utils.printExpected(parent)

    return passResult(this, pass, {
      matcherName: 'toBeWithinPath',
      expectedLabel: 'parent',
      positive: `Expected ${printed} to be within ${parentPrinted}`,
      negative: `Expected ${printed} not to be within ${parentPrinted}`,
      details: Kitz.Path.Dir.is(parent)
        ? undefined
        : `Parent: ${this.utils.printExpected(parent)} is not a path directory`,
    })
  },

  toEncodeTo(this: MatcherState, received: unknown, expected: string): MatcherResult {
    const actual = Kitz.Path.Any.is(received) ? received.toString() : undefined
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

/** Path-aware matchers for `@kitz/effect` values. Registered by `@kitz/vitest/setup`. */
export const Path = {
  /** Register the path matchers on the per-worker `expect`. */
  addMatchers: (): void => {
    expect.extend(matchers)
  },
}
