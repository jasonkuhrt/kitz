import type { Resolution } from './resolution.js'

interface Nil {
  readonly _tag: 'Nil'
}

interface BeginPalette {
  readonly _tag: 'BeginPalette'
  readonly resolution: Resolution
}

interface BeginShortcut {
  readonly _tag: 'BeginShortcut'
  readonly resolution: Resolution
  readonly executable: boolean
}

interface ResolutionResult {
  readonly _tag: 'Resolution'
  readonly resolution: Resolution
}

interface Execute {
  readonly _tag: 'Execute'
  readonly resolution: Resolution
}

interface Close {
  readonly _tag: 'Close'
}

/** Discriminated union of all possible handleKey results. */
export type HandleKeyResult =
  | Nil
  | BeginPalette
  | BeginShortcut
  | ResolutionResult
  | Execute
  | Close

/** Constructors for HandleKeyResult variants. */
export const HandleKeyResult = {
  Nil: (): Nil => ({ _tag: 'Nil' }),

  BeginPalette: (resolution: Resolution): BeginPalette => ({
    _tag: 'BeginPalette',
    resolution,
  }),

  BeginShortcut: (resolution: Resolution, executable: boolean): BeginShortcut => ({
    _tag: 'BeginShortcut',
    resolution,
    executable,
  }),

  Resolution: (resolution: Resolution): ResolutionResult => ({
    _tag: 'Resolution',
    resolution,
  }),

  Execute: (resolution: Resolution): Execute => ({
    _tag: 'Execute',
    resolution,
  }),

  Close: (): Close => ({ _tag: 'Close' }),
} as const
