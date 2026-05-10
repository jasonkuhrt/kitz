import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '../test.js'
import { Spinner } from './spinner.js'

describe('Spinner', () => {
  test('uses the default label when none is provided', async () => {
    const setup = await TuiTest.render(<Spinner />, { width: 30, height: 1 })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('Loading...')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders the provided label', async () => {
    const setup = await TuiTest.render(<Spinner label="Building plan..." />, {
      width: 30,
      height: 1,
    })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('Building plan...')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('shows the first braille frame on initial render', async () => {
    const setup = await TuiTest.render(<Spinner label="x" />, { width: 10, height: 1 })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('⠋')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('layout snapshot at default width', async () => {
    const setup = await TuiTest.render(<Spinner label="Building plan..." />, {
      width: 30,
      height: 1,
    })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toMatchSnapshot()
    } finally {
      setup.renderer.destroy()
    }
  })
})
