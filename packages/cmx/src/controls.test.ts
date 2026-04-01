import { describe, expect, it } from 'vitest'
import { Controls } from './controls.js'

describe('Controls.defaults', () => {
  it('has openPalette', () => {
    expect(Controls.defaults.openPalette).toBe(';')
  })
  it('has confirm', () => {
    expect(Controls.defaults.confirm).toBe('Enter')
  })
  it('has complete', () => {
    expect(Controls.defaults.complete).toBe('Tab')
  })
  it('has cancel', () => {
    expect(Controls.defaults.cancel).toBe('Escape')
  })
  it('has backspace', () => {
    expect(Controls.defaults.backspace).toBe('Backspace')
  })
  it('has toggleMode', () => {
    expect(Controls.defaults.toggleMode).toBe('?')
  })
})

describe('Controls.classify', () => {
  const config = Controls.defaults

  it('classifies openPalette key', () => {
    expect(Controls.classify(config, ';')).toBe('openPalette')
  })
  it('classifies confirm key', () => {
    expect(Controls.classify(config, 'Enter')).toBe('confirm')
  })
  it('classifies complete key', () => {
    expect(Controls.classify(config, 'Tab')).toBe('complete')
  })
  it('classifies cancel key', () => {
    expect(Controls.classify(config, 'Escape')).toBe('cancel')
  })
  it('classifies backspace key', () => {
    expect(Controls.classify(config, 'Backspace')).toBe('backspace')
  })
  it('classifies toggleMode key', () => {
    expect(Controls.classify(config, '?')).toBe('toggleMode')
  })
  it('classifies space', () => {
    expect(Controls.classify(config, ' ')).toBe('space')
  })
  it('classifies printable character', () => {
    expect(Controls.classify(config, 'c')).toBe('printable')
    expect(Controls.classify(config, 'C')).toBe('printable')
    expect(Controls.classify(config, '1')).toBe('printable')
    expect(Controls.classify(config, '/')).toBe('printable')
  })
  it('returns null for non-printable, non-mapped key', () => {
    expect(Controls.classify(config, 'F12')).toBeNull()
    expect(Controls.classify(config, 'ArrowDown')).toBeNull()
    expect(Controls.classify(config, 'Shift')).toBeNull()
  })
})

describe('Controls.classifyTier1', () => {
  const config = Controls.defaults

  it('recognizes openPalette', () => {
    expect(Controls.classifyTier1(config, ';')).toBe('openPalette')
  })
  it('returns null for everything else', () => {
    expect(Controls.classifyTier1(config, 'Enter')).toBeNull()
    expect(Controls.classifyTier1(config, 'c')).toBeNull()
    expect(Controls.classifyTier1(config, 'Tab')).toBeNull()
  })
})

describe('Controls with custom config', () => {
  const custom = { ...Controls.defaults, openPalette: ':', toggleMode: '/' }

  it('uses custom openPalette', () => {
    expect(Controls.classify(custom, ':')).toBe('openPalette')
    expect(Controls.classify(custom, ';')).toBe('printable') // no longer openPalette
  })
  it('uses custom toggleMode', () => {
    expect(Controls.classify(custom, '/')).toBe('toggleMode')
    expect(Controls.classify(custom, '?')).toBe('printable') // no longer toggleMode
  })
})
