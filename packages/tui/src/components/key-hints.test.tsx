import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '../test.js'
import { KeyHints } from './key-hints.js'

describe('KeyHints', () => {
  test('renders each hint as a key/label pair', async () => {
    const setup = await TuiTest.render(
      <KeyHints
        hints={[
          { key: 'q', label: 'quit' },
          { key: '?', label: 'help' },
        ]}
      />,
      { width: 40, height: 1 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('q quit')
      expect(frame).toContain('? help')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders an empty hints array as an empty row without crashing', async () => {
    const setup = await TuiTest.render(<KeyHints hints={[]} />, { width: 20, height: 1 })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(typeof setup.captureCharFrame()).toBe('string')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('preserves hint ordering left-to-right', async () => {
    const setup = await TuiTest.render(
      <KeyHints
        hints={[
          { key: 'a', label: 'alpha' },
          { key: 'b', label: 'beta' },
          { key: 'c', label: 'gamma' },
        ]}
      />,
      { width: 60, height: 1 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      const alphaIndex = frame.indexOf('alpha')
      const betaIndex = frame.indexOf('beta')
      const gammaIndex = frame.indexOf('gamma')
      expect(alphaIndex).toBeGreaterThan(-1)
      expect(betaIndex).toBeGreaterThan(alphaIndex)
      expect(gammaIndex).toBeGreaterThan(betaIndex)
    } finally {
      setup.renderer.destroy()
    }
  })
})
