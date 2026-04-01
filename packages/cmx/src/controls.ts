/** Configuration for key-to-operation mapping. */
export interface ControlsConfig {
  /** Key that opens the command palette. */
  readonly openPalette: string
  /** Key that confirms/executes (Enter). */
  readonly confirm: string
  /** Key that completes/drills (Tab). */
  readonly complete: string
  /** Key that cancels the session (Escape). */
  readonly cancel: string
  /** Key that deletes the last character (Backspace). */
  readonly backspace: string
  /** Key that toggles flat/tree mode. */
  readonly toggleMode: string
}

/** Classified action from a key event. */
export type ControlAction =
  | 'openPalette'
  | 'confirm'
  | 'complete'
  | 'cancel'
  | 'backspace'
  | 'toggleMode'
  | 'space'
  | 'printable'

const defaults: ControlsConfig = {
  openPalette: ';',
  confirm: 'Enter',
  complete: 'Tab',
  cancel: 'Escape',
  backspace: 'Backspace',
  toggleMode: '?',
}

/** Returns true if the key is a single printable character. */
const isPrintable = (key: string): boolean => key.length === 1

/**
 * Classify a key event against a controls config.
 * Returns the action, or null if the key is not recognized.
 */
const classify = (config: ControlsConfig, key: string): ControlAction | null => {
  if (key === config.openPalette) return 'openPalette'
  if (key === config.confirm) return 'confirm'
  if (key === config.complete) return 'complete'
  if (key === config.cancel) return 'cancel'
  if (key === config.backspace) return 'backspace'
  if (key === config.toggleMode) return 'toggleMode'
  if (key === ' ') return 'space'
  if (isPrintable(key)) return 'printable'
  return null
}

/**
 * Classify for Tier 1 (no active session).
 * Only openPalette is checked from Controls.
 */
const classifyTier1 = (config: ControlsConfig, key: string): 'openPalette' | null => {
  if (key === config.openPalette) return 'openPalette'
  return null
}

export const Controls = {
  defaults,
  classify,
  classifyTier1,
} as const
