import { act } from 'react'
import { describe, expect, test } from 'bun:test'
import * as TuiTest from '@kitz/tui/test'
import { DiffPane, HelpOverlay, PackageList } from './ui-components.js'

describe('ui-components', () => {
  test('renders package markers', async () => {
    const setup = await TuiTest.render(
      <PackageList
        packages={[
          { scope: 'alpha', name: '@kitz/alpha' },
          { scope: 'beta', name: '@kitz/beta' },
        ]}
        excludedPackages={['alpha']}
        cursor={0}
      />,
      { width: 60, height: 6 },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('> [ ] alpha @kitz/alpha')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders the empty diff state', async () => {
    const setup = await TuiTest.render(
      <DiffPane persistedText={undefined} draftText={undefined} />,
      {
        width: 60,
        height: 4,
      },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      expect(setup.captureCharFrame()).toContain('No draft to compare.')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders the normalized no-change diff state', async () => {
    const setup = await TuiTest.render(
      <DiffPane persistedText={'{\n  "a": 1\n}'} draftText={'{"a":1}'} />,
      {
        width: 60,
        height: 4,
      },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('No changes. Draft matches persisted plan.')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders a unified diff when the draft changed', async () => {
    const setup = await TuiTest.render(
      <DiffPane persistedText={'{"a":1}'} draftText={'{"a":2}'} />,
      {
        width: 60,
        height: 8,
      },
    )

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      // Real line diff: unchanged lines are context, only the changed line
      // carries -/+ markers (regression: the old implementation emitted every
      // line as removed+added, rendering any change as a 100%-changed wall).
      expect(frame).toContain('2 -   "a": 1')
      expect(frame).toContain('2 +   "a": 2')
      expect(frame).toContain('1   {')
      expect(frame).not.toContain('- {')
      expect(frame).not.toContain('+ {')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('renders the help overlay copy', async () => {
    const setup = await TuiTest.render(<HelpOverlay />, { width: 90, height: 20 })

    try {
      await act(async () => {
        await setup.renderOnce()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain('Release UI — Interactive Release Dashboard')
    } finally {
      setup.renderer.destroy()
    }
  })
})
