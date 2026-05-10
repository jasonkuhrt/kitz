import type { TestRendererOptions } from '@opentui/core/testing'
import { testRender } from '@opentui/react/test-utils'
import { createRef, type ReactNode } from 'react'
import { Program, type ProgramProps, type ProgramTestHandle } from './program.js'

const defaultOptions: TestRendererOptions = {}

export const render = (node: ReactNode, options?: TestRendererOptions) =>
  testRender(node, options ?? defaultOptions)

export type RenderProgramSetup = Awaited<ReturnType<typeof testRender>> & {
  /**
   * Awaits all in-flight controller work (initial commands, dispatched
   * actions, command-completion fibers) and then performs one render pass
   * to apply any newly-batched state. Use this inside `act(...)` blocks to
   * deterministically settle the program before assertions:
   *
   * ```ts
   * await act(async () => {
   *   setup.mockInput.pressKey('i')
   *   await setup.flush()
   * })
   * expect(setup.captureCharFrame()).toContain('count=2')
   * ```
   */
  readonly flush: () => Promise<void>
  /**
   * Performs N consecutive render passes. Useful when a test needs to
   * advance React's render cycle without waiting for controller fibers
   * (e.g. asserting that nothing changed). Defaults to 1 pass; previous
   * code paths used 4 as a probabilistic settle — prefer `flush()` for
   * those cases.
   */
  readonly drain: (frames?: number) => Promise<void>
}

export const renderProgram = async <State, Action, Command, R>(
  props: ProgramProps<State, Action, Command, R>,
  options?: TestRendererOptions,
): Promise<RenderProgramSetup> => {
  const ref = createRef<ProgramTestHandle>()
  const setup = await testRender(<Program {...props} ref={ref} />, options ?? defaultOptions)
  const drain = async (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential render passes by design
      await setup.renderOnce()
    }
  }
  const flush = async () => {
    // Yield to the macrotask queue first. This is needed because
    // `setup.mockInput.pressKey()` synchronously emits to the renderer's
    // stdin EventEmitter, but the keyHandler's `keypress` event (which
    // useKeyboard subscribes to) is processed on a subsequent tick. Without
    // this yield, the dispatch work fiber hasn't been forked yet when
    // settled() runs, so we'd "settle" to zero before the dispatch even
    // started. (Macrotask via setTimeout(0) covers both microtasks and the
    // OpenTUI input-processing tick.)
    //
    // Native Promise is intentional: this is a test-helper boundary, not an
    // Effect-domain operation. Wrapping in Effect.sleep('0 millis') would
    // add ceremony without semantic value.
    // oxlint-disable-next-line kitz/effect/no-native-promise-construction -- intentional macrotask yield, see comment above
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    // Iterative drain. On each pass:
    //   1. renderOnce() — let OpenTUI process pending events and let React
    //      apply state updates from useSyncExternalStore.
    //   2. settled() — await all currently-tracked work fibers (initial
    //      commands, dispatched actions, command-completion chains).
    // Two passes is enough for typical Elm-style action chains. Capped to
    // protect against pathological specs that infinitely re-dispatch.
    const MAX_PASSES = 4
    for (let i = 0; i < MAX_PASSES; i++) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential render→settle generations by design
      await setup.renderOnce()
      // oxlint-disable-next-line eslint/no-await-in-loop -- see comment above
      await ref.current?.settled()
    }
  }
  return Object.assign(setup, { flush, drain })
}
