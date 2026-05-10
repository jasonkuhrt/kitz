import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '../test.js'
import { StatusBar } from './status-bar.js'

describe('StatusBar', () => {
  test('renders entries as label/value pairs', async () => {
    const setup = await TuiTest.render(
      <StatusBar
        entries={[
          { label: 'Plan', value: '/repo/.release/plan.json' },
          { label: 'State', value: 'official plan' },
        ]}
      />,
      { width: 80, height: 1 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Plan: /repo/.release/plan.json')
      expect(frame).toContain('State: official plan')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders the optional message after the entries', async () => {
    const setup = await TuiTest.render(
      <StatusBar
        entries={[{ label: 'Plan', value: 'p.json' }]}
        message="Refreshing workspace..."
      />,
      { width: 80, height: 1 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Plan: p.json')
      expect(frame).toContain('Refreshing workspace...')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('omits the message slot when no message is provided', async () => {
    const setup = await TuiTest.render(
      <StatusBar entries={[{ label: 'Plan', value: 'p.json' }]} />,
      { width: 60, height: 1 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Plan: p.json')
      expect(frame).not.toContain('Refreshing')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders an empty entries array without crashing', async () => {
    const setup = await TuiTest.render(<StatusBar entries={[]} message="hello" />, {
      width: 30,
      height: 1,
    })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('hello')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('layout snapshot: dashboard-style entries + message', async () => {
    const setup = await TuiTest.render(
      <StatusBar
        entries={[
          { label: 'Plan', value: '/repo/.release/plan.json' },
          { label: 'State', value: 'official plan' },
        ]}
        message="Loaded 5 packages."
      />,
      { width: 100, height: 1 },
    )

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
