import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '../test.js'
import { Panel } from './panel.js'

describe('Panel', () => {
  test('renders the title in its border', async () => {
    const setup = await TuiTest.render(
      <Panel title="Packages">
        <text content="alpha" />
      </Panel>,
      { width: 30, height: 4 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Packages')
      expect(frame).toContain('alpha')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders without crashing when given no children', async () => {
    const setup = await TuiTest.render(<Panel title="Empty" />, { width: 20, height: 4 })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('Empty')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('honours width and height props', async () => {
    const setup = await TuiTest.render(
      <Panel title="Sized" width={20} height={3}>
        <text content="content" />
      </Panel>,
      { width: 40, height: 6 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Sized')
      expect(frame).toContain('content')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('accepts percentage and flexGrow sizing without runtime errors', async () => {
    const setup = await TuiTest.render(
      <box flexDirection="row" width="100%" height={4}>
        <Panel title="Half" width="50%">
          <text content="left" />
        </Panel>
        <Panel title="Grow" flexGrow={1}>
          <text content="right" />
        </Panel>
      </box>,
      { width: 40, height: 4 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Half')
      expect(frame).toContain('Grow')
      expect(frame).toContain('left')
      expect(frame).toContain('right')
    } finally {
      setup.renderer.destroy()
    }
  })
})
