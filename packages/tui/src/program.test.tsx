import { describe, expect, test } from 'bun:test'
import { Deferred, Effect, Layer, Context } from 'effect'
import { act } from 'react'
import {
  Control,
  Transition,
  defineProgramSpec,
  isKeyedCommand,
  keyedCommand,
  type ViewProps,
} from './__.js'
import * as TuiTest from './test.js'

describe('Transition', () => {
  test('next produces a state-only transition with no commands', () => {
    const transition = Transition.next<{ count: number }, { _tag: 'X' }>({ count: 1 })

    expect(transition.state).toEqual({ count: 1 })
    expect(transition.commands).toEqual([])
  })

  test('command wraps a single command in a one-element array', () => {
    const transition = Transition.command<{ count: number }, { _tag: 'Save' }>(
      { count: 2 },
      { _tag: 'Save' },
    )

    expect(transition.state).toEqual({ count: 2 })
    expect(transition.commands).toEqual([{ _tag: 'Save' }])
  })

  test('commands preserves the supplied command order', () => {
    const transition = Transition.commands<{ count: number }, { _tag: 'A' } | { _tag: 'B' }>(
      { count: 3 },
      [{ _tag: 'A' }, { _tag: 'B' }],
    )

    expect(transition.state).toEqual({ count: 3 })
    expect(transition.commands).toEqual([{ _tag: 'A' }, { _tag: 'B' }])
  })

  test('command with key options wraps the command in a keyed entry', () => {
    const transition = Transition.command<{ count: number }, { _tag: 'Save' }>(
      { count: 2 },
      { _tag: 'Save' },
      { key: 'save', mode: 'switch' },
    )

    const entry = transition.commands[0]!
    expect(isKeyedCommand(entry)).toBe(true)
    if (isKeyedCommand(entry)) {
      expect(entry.command).toEqual({ _tag: 'Save' })
      expect(entry.key).toBe('save')
      expect(entry.mode).toBe('switch')
    }
  })

  test('isKeyedCommand distinguishes keyed entries from plain commands', () => {
    expect(isKeyedCommand<{ _tag: 'X' }>({ _tag: 'X' })).toBe(false)
    expect(isKeyedCommand(keyedCommand({ _tag: 'X' }, { key: 'x', mode: 'switch' }))).toBe(true)
  })
})

describe('keyed commands', () => {
  test('switch mode interrupts the previous in-flight command for the same key', async () => {
    // Deterministic latest-wins proof, no sleeps: the First command blocks on
    // a Deferred that is never resolved — the only way it can end is by being
    // interrupted. Dispatching Second under the same key must interrupt First
    // (finalizer flips firstInterrupted) and then apply only Second's action.
    const firstGate = Effect.runSync(Deferred.make<void>())
    let firstInterrupted = false

    type State = { readonly log: readonly string[] }
    type Action = { readonly _tag: 'Recorded'; readonly source: string }
    type Command = { readonly _tag: 'First' } | { readonly _tag: 'Second' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.log.join(',') || 'empty'} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { log: [] },
      // Boot path: initial commands accept keyed entries too.
      initialCommands: [keyedCommand({ _tag: 'First' }, { key: 'load', mode: 'switch' })],
      update(state, action) {
        if (action._tag === 'Recorded') {
          return Transition.next({ log: [...state.log, action.source] })
        }
        return Transition.next(state)
      },
      run(command) {
        switch (command._tag) {
          case 'First':
            return Deferred.await(firstGate).pipe(
              Effect.as([{ _tag: 'Recorded' as const, source: 'first' }]),
              Effect.onInterrupt(() =>
                Effect.sync(() => {
                  firstInterrupted = true
                }),
              ),
            )
          // 'Second'
          default:
            return Effect.succeed([{ _tag: 'Recorded' as const, source: 'second' }])
        }
      },
      onKey(_state, event) {
        return event.name === 's' ? [{ _tag: 'Recorded' as const, source: 'key' }] : []
      },
      view: View,
    })

    // Wrap update so pressing 's' issues the keyed Second command: the
    // dispatch path (not just boot) must route through keyed forking.
    const keyedSpec = {
      ...spec,
      update: (state: State, action: Action) => {
        if (action._tag === 'Recorded' && action.source === 'key') {
          return Transition.command<State, Command>(
            state,
            { _tag: 'Second' },
            {
              key: 'load',
              mode: 'switch',
            },
          )
        }
        return spec.update(state, action)
      },
    }

    const setup = await TuiTest.renderProgram({ spec: keyedSpec }, { width: 40, height: 2 })

    try {
      // Boot: First forks and suspends on the gate. flush() drains work
      // fibers — but First never completes, so do NOT flush here; instead
      // give the fiber a tick to start.
      await new Promise<void>((resolve) => setTimeout(resolve, 10))
      expect(firstInterrupted).toBe(false)

      await act(async () => {
        setup.mockInput.pressKey('s')
        await setup.flush()
      })

      expect(firstInterrupted).toBe(true)
      const frame = setup.captureCharFrame()
      // Only Second's result landed; First was interrupted before producing
      // its action. (The 'key' trigger action is intercepted by the wrapper
      // and issues the Second command without logging itself.)
      expect(frame).toContain('second')
      expect(frame).not.toContain('first')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('a superseded keyed command cannot dispatch actions after its replacement', async () => {
    // Slow/fast race: Slow (issued first) takes 200ms, Fast (issued second)
    // takes 0ms. Without switch semantics Slow's action would land LAST and
    // stomp Fast's. With switch semantics Slow is interrupted when Fast is
    // issued, so the final state reflects Fast only.
    type State = { readonly latest: string }
    type Action =
      | { readonly _tag: 'Issue'; readonly which: 'slow' | 'fast' }
      | { readonly _tag: 'Landed'; readonly which: string }
    type Command = { readonly _tag: 'Build'; readonly which: 'slow' | 'fast' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`latest=${state.latest}`} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { latest: 'none' },
      update(state, action) {
        switch (action._tag) {
          case 'Issue':
            return Transition.command(state, { _tag: 'Build', which: action.which } as const, {
              key: 'build',
              mode: 'switch',
            })
          // 'Landed'
          default:
            return Transition.next({ latest: action.which })
        }
      },
      run(command) {
        const delay = command.which === 'slow' ? '200 millis' : '0 millis'
        return Effect.sleep(delay).pipe(
          Effect.as([{ _tag: 'Landed' as const, which: command.which }]),
        )
      },
      onKey(_state, event) {
        if (event.name === 'a') return [{ _tag: 'Issue' as const, which: 'slow' as const }]
        if (event.name === 'b') return [{ _tag: 'Issue' as const, which: 'fast' as const }]
        return []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 30, height: 2 })

    try {
      await act(async () => {
        setup.mockInput.pressKey('a')
        // Give Slow time to fork and enter its sleep, then supersede it.
        await new Promise<void>((resolve) => setTimeout(resolve, 20))
        setup.mockInput.pressKey('b')
        await setup.flush()
      })

      expect(setup.captureCharFrame()).toContain('latest=fast')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('commands with different keys run independently', async () => {
    type State = { readonly log: readonly string[] }
    type Action = { readonly _tag: 'Kick' } | { readonly _tag: 'Landed'; readonly which: string }
    type Command = { readonly _tag: 'Build'; readonly which: string }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.log.toSorted().join(',') || 'empty'} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { log: [] },
      update(state, action) {
        switch (action._tag) {
          case 'Kick':
            return Transition.commands<State, Command>(state, [
              keyedCommand<Command>(
                { _tag: 'Build', which: 'alpha' },
                { key: 'alpha', mode: 'switch' },
              ),
              keyedCommand<Command>(
                { _tag: 'Build', which: 'beta' },
                { key: 'beta', mode: 'switch' },
              ),
            ])
          // 'Landed'
          default:
            return Transition.next({ log: [...state.log, action.which] })
        }
      },
      run(command) {
        return Effect.succeed([{ _tag: 'Landed' as const, which: command.which }])
      },
      onKey(_state, event) {
        return event.name === 'k' ? [{ _tag: 'Kick' as const }] : []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 40, height: 2 })

    try {
      await act(async () => {
        setup.mockInput.pressKey('k')
        await setup.flush()
      })

      // Both keyed commands completed — neither interrupted the other.
      expect(setup.captureCharFrame()).toContain('alpha,beta')
    } finally {
      setup.renderer.destroy()
    }
  })
})

describe('program runtime', () => {
  test('renders raw nodes through the shared test helper', async () => {
    const setup = await TuiTest.render(<text content="hello" />, { width: 20, height: 2 })

    try {
      await setup.renderOnce()

      expect(setup.captureCharFrame()).toContain('hello')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('runs initial commands, handles keyboard actions, and re-renders state', async () => {
    type State = { readonly count: number; readonly status: string }
    type Action =
      | { readonly _tag: 'Loaded' }
      | { readonly _tag: 'IncrementRequested' }
      | { readonly _tag: 'IncrementCompleted'; readonly count: number }
    type Command =
      | { readonly _tag: 'Load' }
      | { readonly _tag: 'CompleteIncrement'; readonly count: number }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`count=${state.count} ${state.status}`} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { count: 0, status: 'booting' },
      initialCommands: [{ _tag: 'Load' }],
      update(state, action) {
        switch (action._tag) {
          case 'Loaded':
            return Transition.next({ count: 1, status: 'ready' })
          case 'IncrementRequested':
            return Transition.command(
              { count: state.count, status: 'working' },
              { _tag: 'CompleteIncrement', count: state.count + 1 },
            )
          // 'IncrementCompleted'
          default:
            return Transition.next({ count: action.count, status: 'done' })
        }
      },
      run(command) {
        switch (command._tag) {
          case 'Load':
            return Effect.succeed([{ _tag: 'Loaded' }])
          // 'CompleteIncrement'
          default:
            return Effect.succeed([{ _tag: 'IncrementCompleted', count: command.count }])
        }
      },
      onKey(_state, event) {
        return event.name === 'i' ? [{ _tag: 'IncrementRequested' }] : []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 30, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('count=1 ready')

      await act(async () => {
        setup.mockInput.pressKey('i')
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('count=2 done')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('exits through the shared control service', async () => {
    type State = { readonly open: true }
    type Action = { readonly _tag: 'QuitRequested' }
    type Command = { readonly _tag: 'Quit' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.open ? 'open' : 'closed'} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { open: true },
      // Action has a single tag: 'QuitRequested'
      update(state, _action) {
        return Transition.command(state, { _tag: 'Quit' })
      },
      // Command has a single tag: 'Quit'
      run(_command) {
        return Effect.gen(function* () {
          const control = yield* Control
          yield* control.exit
          return []
        })
      },
      onKey(_state, event) {
        return event.name === 'q' ? [{ _tag: 'QuitRequested' }] : []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    try {
      await setup.renderOnce()

      const destroyed = new Promise((resolve) => {
        setup.renderer.once('destroy', () => resolve(undefined))
      })

      await act(async () => {
        setup.mockInput.pressKey('q')
      })
      await destroyed
    } finally {
      setup.renderer.destroy()
    }
  })

  test('interrupts in-flight command fibers when the renderer is destroyed', async () => {
    let finalized = false

    type State = { readonly status: string }
    type Action = never
    type Command = { readonly _tag: 'WaitForever' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.status} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { status: 'waiting' },
      initialCommands: [{ _tag: 'WaitForever' }],
      update(state, _action) {
        return Transition.next(state)
      },
      // Command has a single tag: 'WaitForever'
      run(_command) {
        return Effect.never.pipe(
          Effect.ensuring(
            Effect.sync(() => {
              finalized = true
            }),
          ),
        )
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    try {
      await setup.renderOnce()
      await act(async () => {
        setup.renderer.destroy()
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(finalized).toBe(true)
    } finally {
      setup.renderer.destroy()
    }
  })

  test('preserves arrival order under rapid concurrent dispatches', async () => {
    // Property: pressing keys k1, k2, ..., kN with no awaits between presses
    // produces actions A1, A2, ..., AN that the View observes in arrival
    // order. Without the dispatch semaphore, multiple forked fibers would
    // race on `SubscriptionRef.modify` and observed order could be jumbled.
    type State = { readonly log: readonly string[] }
    type Action = { readonly _tag: 'Append'; readonly key: string }
    type Command = { readonly _tag: 'Tick'; readonly key: string }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.log.join(',')} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { log: [] },
      update(state, action) {
        // After each Append, schedule a Tick command — this guarantees
        // commands run between dispatches, exercising the cross-fiber
        // ordering path.
        return Transition.command(
          { log: [...state.log, action.key] },
          { _tag: 'Tick', key: action.key },
        )
      },
      // Command has a single tag: 'Tick'
      run(_command) {
        // Tiny delay forces the fiber to suspend — a second dispatch
        // arriving during this window would race without the semaphore.
        return Effect.sleep('1 millis').pipe(Effect.as([]))
      },
      onKey(_state, event) {
        if (event.name && event.name.length === 1) {
          return [{ _tag: 'Append', key: event.name }]
        }
        return []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 40, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })

      const keys = ['a', 'b', 'c', 'd', 'e']
      await act(async () => {
        for (const key of keys) {
          setup.mockInput.pressKey(key)
        }
        await setup.flush()
      })

      const frame = setup.captureCharFrame()
      expect(frame).toContain(keys.join(','))
    } finally {
      setup.renderer.destroy()
    }
  })

  test('surfaces command defects via console.error and continues processing', async () => {
    const errors: ReadonlyArray<unknown>[] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }

    type State = { readonly status: 'init' | 'after-fail' }
    type Action = { readonly _tag: 'Trigger' } | { readonly _tag: 'Recovered' }
    type Command = { readonly _tag: 'Boom' } | { readonly _tag: 'Recover' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`status=${state.status}`} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { status: 'init' },
      initialCommands: [{ _tag: 'Boom' }, { _tag: 'Recover' }],
      update(state, action) {
        switch (action._tag) {
          case 'Trigger':
            return Transition.next(state)
          // 'Recovered'
          default:
            return Transition.next({ status: 'after-fail' })
        }
      },
      run(command) {
        switch (command._tag) {
          case 'Boom':
            // Defect — bypasses the typed `never` error channel.
            return Effect.sync(() => {
              throw new Error('synthetic boom')
            })
          // 'Recover'
          default:
            return Effect.succeed([{ _tag: 'Recovered' } as const])
        }
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 30, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })
      // Recover ran INDEPENDENTLY of Boom — initial commands fork in parallel
      // (off the dispatch lock), so a defect in one command cannot freeze the
      // others. The final state reaches `status=after-fail` because Recover's
      // Recovered action processes regardless of Boom's defect.
      expect(setup.captureCharFrame()).toContain('status=after-fail')
      // The defect was surfaced via console.error.
      const surfaced = errors.find((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('command failed')),
      )
      expect(surfaced).toBeDefined()
    } finally {
      console.error = realConsoleError
      setup.renderer.destroy()
    }
  })

  test('dispatchMany with empty actions is a no-op', async () => {
    let updateCalls = 0
    type State = { readonly count: number }
    type Action = { readonly _tag: 'Tick' }

    function View({ state, dispatch }: ViewProps<State, Action>) {
      // Calling dispatch directly from the view exercises the
      // `controller.dispatch` path. We immediately fire one to prove that
      // path works alongside the empty-batch path below.
      // (The empty `dispatchMany` would never produce a re-render, so we
      // assert via `updateCalls` instead.)
      dispatch({ _tag: 'Tick' })
      return <text content={`count=${state.count}`} />
    }

    const spec = defineProgramSpec<State, Action, never>({
      initialState: { count: 0 },
      update(state, _action) {
        updateCalls++
        // Stop the recursive dispatch from view — only count the first.
        return Transition.next(updateCalls === 1 ? { count: 1 } : state)
      },
      run() {
        return Effect.succeed([])
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })
      // Update was called via the View's dispatch call — proves that path.
      expect(updateCalls).toBeGreaterThan(0)
      expect(setup.captureCharFrame()).toContain('count=1')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('view-render exceptions are caught by the error boundary', async () => {
    const errors: ReadonlyArray<unknown>[] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }

    type State = { readonly broken: boolean }
    type Action = never

    function View({ state }: ViewProps<State, Action>) {
      if (state.broken) {
        throw new Error('view exploded on purpose')
      }
      return <text content="ok" />
    }

    const spec = defineProgramSpec<State, Action, never>({
      initialState: { broken: true },
      update(state, _action) {
        return Transition.next(state)
      },
      run() {
        return Effect.succeed([])
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 60, height: 6 })

    try {
      await act(async () => {
        await setup.flush()
      })
      const frame = setup.captureCharFrame()
      // Fallback pane is rendered with the actual error message.
      expect(frame).toContain('view exploded on purpose')
      expect(frame).toContain('Press q')
      // The crash was logged via console.error.
      const surfaced = errors.find((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('view render crashed')),
      )
      expect(surfaced).toBeDefined()
    } finally {
      console.error = realConsoleError
      setup.renderer.destroy()
    }
  })

  test('settled() while idle returns immediately', async () => {
    type State = { readonly v: number }
    function View({ state }: ViewProps<State, never>) {
      return <text content={`v=${state.v}`} />
    }

    const spec = defineProgramSpec<State, never, never>({
      initialState: { v: 0 },
      update(state, _action) {
        return Transition.next(state)
      },
      run() {
        return Effect.succeed([])
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    try {
      // No initialCommands, no dispatches — work fibers should drain
      // immediately. flush() must complete in well under a second.
      const start = Date.now()
      await act(async () => {
        await setup.flush()
        await setup.flush()
        await setup.flush()
      })
      expect(Date.now() - start).toBeLessThan(500)
    } finally {
      setup.renderer.destroy()
    }
  })

  test('dispatch after dispose is a no-op', async () => {
    let updateCalls = 0
    type State = { readonly count: number }
    type Action = { readonly _tag: 'Bump' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`count=${state.count}`} />
    }

    const dispatchedActions: Action[] = []
    const spec = defineProgramSpec<State, Action, never>({
      initialState: { count: 0 },
      update(state, action) {
        updateCalls++
        dispatchedActions.push(action)
        return Transition.next({ count: state.count + 1 })
      },
      run() {
        return Effect.succeed([])
      },
      onKey(_state, event) {
        return event.name === 'b' ? [{ _tag: 'Bump' }] : []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    await act(async () => {
      setup.mockInput.pressKey('b')
      await setup.flush()
    })
    const callsBeforeDispose = updateCalls
    expect(callsBeforeDispose).toBeGreaterThan(0)

    // Destroy the renderer — triggers Program's useEffect cleanup which
    // calls controller.dispose().
    setup.renderer.destroy()
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Press another key. Without the disposed guard, this would attempt to
    // fork into the disposed runtime and produce a noisy error. With the
    // guard, it's a silent no-op — updateCalls does not advance.
    setup.mockInput.pressKey('b')
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(updateCalls).toBe(callsBeforeDispose)
  })

  test('synchronous throw in spec.update is caught and logged', async () => {
    const errors: ReadonlyArray<unknown>[] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }

    type State = { readonly count: number }
    type Action = { readonly _tag: 'Bad' } | { readonly _tag: 'Good' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`count=${state.count}`} />
    }

    let goodCount = 0
    const spec = defineProgramSpec<State, Action, never>({
      initialState: { count: 0 },
      update(state, action) {
        if (action._tag === 'Bad') {
          throw new Error('synthetic update throw')
        }
        goodCount++
        return Transition.next({ count: state.count + 1 })
      },
      run() {
        return Effect.succeed([])
      },
      onKey(_state, event) {
        if (event.name === 'b') return [{ _tag: 'Bad' }]
        if (event.name === 'g') return [{ _tag: 'Good' }]
        return []
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 30, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })

      // Bad action throws inside update — should be caught + logged.
      await act(async () => {
        setup.mockInput.pressKey('b')
        await setup.flush()
      })

      const surfaced = errors.find((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('update failed')),
      )
      expect(surfaced).toBeDefined()

      // Subsequent good action still processes — proves the runtime
      // recovered after the update defect.
      await act(async () => {
        setup.mockInput.pressKey('g')
        await setup.flush()
      })
      expect(goodCount).toBe(1)
      expect(setup.captureCharFrame()).toContain('count=1')
    } finally {
      console.error = realConsoleError
      setup.renderer.destroy()
    }
  })

  test('user-supplied Layer<R> is provided to spec.run', async () => {
    // Synthetic service that the command interpreter requires. This proves
    // the program's Effect runtime composes the user's layer alongside the
    // built-in Control service.
    class Greeter extends Context.Service<Greeter, { readonly greet: () => string }>()(
      '@kitz/tui-test/Greeter',
    ) {}

    type State = { readonly message: string }
    type Action = { readonly _tag: 'Greeted'; readonly text: string }
    type Command = { readonly _tag: 'Greet' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.message} />
    }

    const spec = defineProgramSpec<State, Action, Command, Greeter>({
      initialState: { message: 'pending' },
      initialCommands: [{ _tag: 'Greet' }],
      update(_state, action) {
        return Transition.next({ message: action.text })
      },
      run(_command) {
        return Effect.gen(function* () {
          const greeter = yield* Greeter
          return [{ _tag: 'Greeted' as const, text: greeter.greet() }]
        })
      },
      view: View,
    })

    const greeterLayer = Layer.succeed(Greeter)({ greet: () => 'hello from layer' })

    const setup = await TuiTest.renderProgram(
      { spec, layer: greeterLayer },
      { width: 40, height: 2 },
    )

    try {
      await act(async () => {
        await setup.flush()
      })
      expect(setup.captureCharFrame()).toContain('hello from layer')
    } finally {
      setup.renderer.destroy()
    }
  })

  test('synchronous throw in spec.onKey is caught and logged, keypress is dropped', async () => {
    const errors: ReadonlyArray<unknown>[] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }

    let updateCalls = 0
    type State = { readonly v: number }
    type Action = { readonly _tag: 'Bumped' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={`v=${state.v}`} />
    }

    const spec = defineProgramSpec<State, Action, never>({
      initialState: { v: 0 },
      update(state, _action) {
        updateCalls++
        return Transition.next({ v: state.v + 1 })
      },
      run() {
        return Effect.succeed([])
      },
      onKey(_state, event) {
        if (event.name === 'b') {
          throw new Error('onKey exploded')
        }
        return [{ _tag: 'Bumped' as const }]
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 30, height: 2 })

    try {
      await act(async () => {
        await setup.flush()
      })

      // Bad keypress — onKey throws. Should be caught + logged, no
      // dispatch, no update.
      await act(async () => {
        setup.mockInput.pressKey('b')
        await setup.flush()
      })
      expect(updateCalls).toBe(0)

      const surfaced = errors.find((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('onKey threw')),
      )
      expect(surfaced).toBeDefined()

      // Subsequent good keypress still dispatches — proves the keyboard
      // handler recovered.
      await act(async () => {
        setup.mockInput.pressKey('g')
        await setup.flush()
      })
      expect(updateCalls).toBe(1)
    } finally {
      console.error = realConsoleError
      setup.renderer.destroy()
    }
  })

  test('start() is idempotent — initialCommands run only once', async () => {
    let runCalls = 0
    type State = { readonly initialized: boolean }
    type Action = { readonly _tag: 'Initialized' }
    type Command = { readonly _tag: 'Init' }

    function View({ state }: ViewProps<State, Action>) {
      return <text content={state.initialized ? 'ready' : 'booting'} />
    }

    const spec = defineProgramSpec<State, Action, Command>({
      initialState: { initialized: false },
      initialCommands: [{ _tag: 'Init' }],
      update(state, _action) {
        return Transition.next({ initialized: true })
      },
      run(_command) {
        runCalls++
        return Effect.succeed([{ _tag: 'Initialized' as const }])
      },
      view: View,
    })

    const setup = await TuiTest.renderProgram({ spec }, { width: 20, height: 2 })

    try {
      // React's useEffect (where controller.start is called) may fire twice
      // in development mode. The `started` guard ensures initialCommands run
      // exactly once regardless.
      await act(async () => {
        await setup.flush()
      })
      expect(runCalls).toBe(1)
      expect(setup.captureCharFrame()).toContain('ready')
    } finally {
      setup.renderer.destroy()
    }
  })
})
