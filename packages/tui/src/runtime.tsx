import { createCliRenderer, type CliRenderer } from '@opentui/core'
import { createRoot, type Root } from '@opentui/react'
import { Effect } from 'effect'
import type { ReactNode } from 'react'

export interface App {
  readonly renderer: CliRenderer
  readonly root: Root
  readonly destroy: () => void
}

export const createApp = (element: ReactNode): Effect.Effect<App> =>
  Effect.promise(async () => {
    const renderer = await createCliRenderer()
    const root = createRoot(renderer)
    root.render(element)
    return {
      renderer,
      root,
      destroy: () => renderer.destroy(),
    }
  })

export const runApp = (element: ReactNode): Effect.Effect<void> =>
  Effect.gen(function* () {
    const app = yield* createApp(element)
    yield* Effect.callback<void>((resume) => {
      app.renderer.on('destroy', () => resume(Effect.void))
    })
  })
