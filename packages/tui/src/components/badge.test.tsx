import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '../test.js'
import { Badge } from './badge.js'

const renderToFrame = async (node: React.ReactNode, width = 30) => {
  const setup = await TuiTest.render(node, { width, height: 1 })
  try {
    await act(async () => {
      await setup.renderOnce()
    })
    return setup.captureCharFrame()
  } finally {
    setup.renderer.destroy()
  }
}

describe('Badge', () => {
  test('renders the label in both active and inactive states', async () => {
    const inactiveFrame = await renderToFrame(<Badge label="OFFICIAL" />)
    const activeFrame = await renderToFrame(<Badge label="OFFICIAL" active />)

    expect(inactiveFrame).toContain('OFFICIAL')
    expect(activeFrame).toContain('OFFICIAL')
  })

  test('active state pads the label content for the highlight gutter', async () => {
    const inactiveFrame = await renderToFrame(<Badge label="OFFICIAL" />)
    const activeFrame = await renderToFrame(<Badge label="OFFICIAL" active />)

    expect(activeFrame).toContain('  OFFICIAL  ')
    expect(inactiveFrame).not.toContain('  OFFICIAL  ')
  })

  test('renders an empty label without crashing', async () => {
    const frame = await renderToFrame(<Badge label="" active />, 10)

    expect(typeof frame).toBe('string')
  })

  test('renders multiple badges side by side and preserves both labels', async () => {
    const frame = await renderToFrame(
      <box flexDirection="row">
        <Badge label="ALPHA" active />
        <Badge label="BETA" />
      </box>,
      40,
    )

    expect(frame).toContain('ALPHA')
    expect(frame).toContain('BETA')
  })

  test('layout snapshot: active vs inactive', async () => {
    // Snapshot the rendered frame for both states. Locks in
    // active/inactive pad-width math + color-code positioning. Update
    // via `bun test --update-snapshots` after intentional UI changes.
    expect(await renderToFrame(<Badge label="OFFICIAL" active />)).toMatchSnapshot()
    expect(await renderToFrame(<Badge label="OFFICIAL" />)).toMatchSnapshot()
  })
})
