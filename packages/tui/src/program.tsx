import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import {
  Array as A,
  Cause,
  Effect,
  Fiber,
  Layer,
  ManagedRuntime,
  Semaphore,
  ServiceMap,
  SubscriptionRef,
} from 'effect'
import {
  Component,
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ErrorInfo,
  type ForwardedRef,
  type ReactNode,
} from 'react'

export class Control extends ServiceMap.Service<Control, { readonly exit: Effect.Effect<void> }>()(
  '@kitz/tui/Control',
) {}

export interface ViewProps<State, Action> {
  readonly state: State
  readonly dispatch: (action: Action) => void
}

export interface Transition<State, Command> {
  readonly state: State
  readonly commands: readonly Command[]
}

export const Transition = {
  next<State, Command>(state: State): Transition<State, Command> {
    return { state, commands: [] }
  },
  command<State, Command>(state: State, command: Command): Transition<State, Command> {
    return { state, commands: [command] }
  },
  commands<State, Command>(state: State, commands: readonly Command[]): Transition<State, Command> {
    return { state, commands }
  },
}

type Batch<Item> = readonly Item[] | Item | void

const isBatchArray = <Item,>(batch: Batch<Item>): batch is readonly Item[] => A.isArray(batch)

export interface ProgramSpec<State, Action, Command, R = never> {
  readonly initialState: State
  readonly initialCommands?: readonly Command[]
  readonly update: (state: State, action: Action) => Transition<State, Command>
  readonly run: (command: Command, state: State) => Effect.Effect<Batch<Action>, never, R | Control>
  readonly onKey?: (state: State, event: KeyEvent) => Batch<Action>
  readonly view: ComponentType<ViewProps<State, Action>>
}

export const defineProgramSpec = <State, Action, Command, R = never>(
  spec: ProgramSpec<State, Action, Command, R>,
) => spec

export interface ProgramProps<State, Action, Command, R = never> {
  readonly spec: ProgramSpec<State, Action, Command, R>
  readonly layer?: Layer.Layer<R>
}

interface Controller<State, Action> {
  readonly getSnapshot: () => State
  readonly subscribe: (listener: () => void) => () => void
  readonly dispatch: (action: Action) => void
  readonly dispatchMany: (actions: readonly Action[]) => void
  readonly start: () => void
  readonly settled: () => Promise<void>
  readonly dispose: () => Promise<void>
}

/**
 * Imperative test handle exposed via {@link Program}'s ref. Tests can await
 * `settled()` to deterministically flush all in-flight controller work
 * (initial commands, dispatched actions, command-completion fibers) before
 * making assertions, eliminating the "render N frames and hope" pattern.
 */
export interface ProgramTestHandle {
  readonly settled: () => Promise<void>
}

const normalizeBatch = <Item,>(batch: Batch<Item>) => {
  if (batch === undefined) return []
  return isBatchArray(batch) ? batch : [batch]
}

const createControlLayer = (destroy: () => void): Layer.Layer<Control> =>
  Layer.succeed(Control)({
    exit: Effect.sync(destroy),
  })

const resolveLayer = <R,>(layer: Layer.Layer<R> | undefined): Layer.Layer<R> =>
  layer ?? (Layer.empty as Layer.Layer<R>)

const toStateModification = <State, Command>(
  transition: Transition<State, Command>,
): readonly [Transition<State, Command>, State] => [
  { state: transition.state, commands: transition.commands },
  transition.state,
]

const createController = <State, Action, Command, R>(
  spec: ProgramSpec<State, Action, Command, R>,
  layer: Layer.Layer<R>,
  destroy: () => void,
): Controller<State, Action> => {
  const runtime = ManagedRuntime.make(Layer.mergeAll(createControlLayer(destroy), layer))
  const stateRef = runtime.runSync(SubscriptionRef.make(spec.initialState))
  const listeners = new Set<() => void>()
  // Work fibers: dispatched actions, command-completion chains, initial-command
  // boots. These complete on their own; `settled()` drains them.
  const workFibers = new Set<Fiber.Fiber<unknown, unknown>>()
  // 1-permit semaphore serializes STATE UPDATES across all dispatch entry
  // points (dispatch, dispatchMany, command-result re-entries). Semaphore.take
  // is documented FIFO, so concurrent external dispatches process in arrival
  // order — preserving the Elm-style "process action A's state update fully
  // before action B's state update" semantic that fire-and-forget forking
  // would violate. Critically, the lock is held ONLY for the synchronous
  // state-update step inside dispatchEffect; commands themselves run on
  // separate fibers OFF the lock, so a long-running command (e.g. the boot
  // sequence's LoadWorkspace) does not block subsequent keypresses from
  // updating state. See runCommand for the command-fiber lifecycle.
  const dispatchLock = runtime.runSync(Semaphore.make(1))
  let started = false
  let disposed = false

  const notifyListeners = Effect.sync(() => {
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        // Each listener is isolated — a thrown listener does not stop the
        // remaining listeners from being notified. React's
        // useSyncExternalStore is the listener in normal use; in pathological
        // cases (a non-React subscriber, a component that throws on
        // re-render attempt, etc.) the program continues.
        // oxlint-disable-next-line eslint/no-console -- intentional surfacing of unexpected listener throw
        console.error('[Tui.Program] state listener threw:', error)
      }
    }
  })

  const trackFiber = (
    set: Set<Fiber.Fiber<unknown, unknown>>,
    fiber: Fiber.Fiber<unknown, unknown>,
  ) => {
    set.add(fiber)
    runtime.runCallback(Fiber.await(fiber).pipe(Effect.asVoid), {
      onExit: () => {
        set.delete(fiber)
      },
    })
  }

  const forkWork = <A,>(effect: Effect.Effect<A, never, R | Control>) => {
    const fiber = runtime.runFork(effect)
    trackFiber(workFibers, fiber)
    return fiber
  }

  // Runs a single command and dispatches its resulting actions back through
  // the dispatch pipeline. Commands run in their own fibers (forked from
  // dispatchEffect or start) — they execute OFF the dispatch lock, so a
  // long-running command no longer blocks other dispatches (e.g. keypresses)
  // from acquiring the lock for their own state updates. The command's
  // resulting actions re-acquire the lock when they dispatch back in.
  const runCommand = (command: Command, state: State): Effect.Effect<void, never, R | Control> =>
    spec.run(command, state).pipe(
      // `spec.run` is typed `Effect<Batch<Action>, never, R | Control>`
      // — error channel `never`. But defects (uncaught throws inside
      // `Effect.sync`, missing layer services, etc.) bypass the type
      // system and would otherwise silently kill the command fiber.
      // Convert any cause into an empty batch + console.error so the
      // failure is observable and the program continues processing.
      Effect.catchCause(
        (cause: Cause.Cause<never>): Effect.Effect<Batch<Action>, never, R | Control> =>
          Effect.sync(() => {
            // oxlint-disable-next-line eslint/no-console -- intentional surfacing of unrecoverable spec.run failures
            console.error(`[Tui.Program] command failed:`, command, '\n' + Cause.pretty(cause))
            return [] as Batch<Action>
          }),
      ),
      Effect.map(normalizeBatch),
      Effect.flatMap((actions) =>
        // Empty action lists are common (e.g. the Quit command returns no
        // actions). Skip the lock acquisition entirely in that case.
        actions.length === 0 ? Effect.void : dispatchLock.withPermits(1)(dispatchAll(actions)),
      ),
    )

  const dispatchAll = (actions: readonly Action[]): Effect.Effect<void, never, R | Control> =>
    Effect.forEach(actions, dispatchEffect, { concurrency: 1, discard: true })

  const dispatchEffect = (action: Action): Effect.Effect<void, never, R | Control> =>
    SubscriptionRef.modify(stateRef, (state) => {
      const transition = spec.update(state, action)
      return toStateModification(transition)
    })
      .pipe(
        // Notify React listeners synchronously after the state mutation.
        // Stream-based notification (via SubscriptionRef.changes) runs on its
        // own fiber and can lag behind dispatchEffect, breaking deterministic
        // settling in tests. Direct notification keeps state mutations and
        // listener firings in lockstep — when settled() returns, React's
        // re-render is already scheduled within the active act() boundary.
        Effect.tap(() => notifyListeners),
        Effect.flatMap(({ state, commands }) =>
          Effect.sync(() => {
            // Fork each command as a separate work fiber, off the dispatch
            // lock. The lock is released as soon as this dispatchEffect
            // returns — long-running commands no longer block other
            // dispatches from acquiring the lock for their own state updates.
            // The forked commands' resulting actions re-acquire the lock
            // (via dispatchLock.withPermits inside runCommand) when they
            // dispatch back in.
            //
            // If the controller has been disposed concurrently with this
            // state update, skip forking — the runtime is about to dispose
            // and any new fibers would be immediately interrupted.
            if (disposed) return
            for (const command of commands) {
              forkWork(runCommand(command, state))
            }
          }),
        ),
      )
      .pipe(
        // Catch defects from `spec.update` throwing synchronously (typed as
        // pure but JS can't enforce that). Without this catch, the dispatch
        // fiber would die silently and the user would see a frozen UI with
        // no diagnostic. Log + treat as no-op so subsequent dispatches still
        // process.
        Effect.catchCause((cause) =>
          Effect.sync(() => {
            // oxlint-disable-next-line eslint/no-console -- intentional surfacing of unrecoverable update failures
            console.error(
              `[Tui.Program] update failed for action:`,
              action,
              '\n' + Cause.pretty(cause),
            )
          }),
        ),
      )

  return {
    getSnapshot: () => SubscriptionRef.getUnsafe(stateRef),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch: (action) => {
      // Late dispatches (e.g. from a keyboard handler that fires during
      // unmount) become no-ops post-dispose rather than crashing into the
      // disposed runtime. The runtime itself rejects new forks, but we
      // short-circuit early to avoid the noisy error path.
      if (disposed) return
      forkWork(dispatchLock.withPermits(1)(dispatchEffect(action)))
    },
    dispatchMany: (actions) => {
      if (disposed) return
      if (actions.length === 0) return
      forkWork(dispatchLock.withPermits(1)(dispatchAll(actions)))
    },
    start: () => {
      if (started) return
      if (disposed) return
      started = true
      const initialCommands = spec.initialCommands ?? []
      if (initialCommands.length === 0) return
      // Fork each initial command as a separate work fiber, off the dispatch
      // lock. There's no state update to serialize at boot, so no lock is
      // needed here; the commands' resulting actions will acquire the lock
      // when they dispatch back in. This is what keeps user input responsive
      // during a long-running boot — the lock isn't held for the entire
      // duration of the initial command chain.
      //
      // Note: multiple initial commands run in parallel (the previous design
      // serialized them via runCommands' concurrency:1 forEach). Specs that
      // need ordered initial-command execution must encode that ordering in
      // their action graph (e.g. command A's resulting action triggers
      // command B), not in the initialCommands array.
      const initialState = SubscriptionRef.getUnsafe(stateRef)
      for (const command of initialCommands) {
        forkWork(runCommand(command, initialState))
      }
    },
    settled: async () => {
      // Drain transitively: each iteration awaits the snapshot of in-flight
      // work fibers; if a dispatched action's command schedules follow-up
      // fibers during the await, the next loop iteration catches them. Loop
      // exits when no work fibers are tracked. Long-running infra fibers
      // (e.g. the state-change stream) are excluded — they only complete on
      // dispose.
      while (workFibers.size > 0) {
        const snapshot = [...workFibers]
        // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design: each generation may spawn the next
        await runtime.runPromise(Effect.forEach(snapshot, Fiber.await, { discard: true }))
      }
    },
    dispose: async () => {
      // Idempotent: subsequent calls to dispose are safe no-ops. React's
      // useEffect cleanup can fire dispose more than once during strict-mode
      // double-invoke or during fast unmount/remount cycles.
      if (disposed) return
      disposed = true
      const allFibers = [...workFibers]
      if (allFibers.length > 0) {
        await runtime.runPromise(Effect.forEach(allFibers, Fiber.interrupt, { discard: true }))
      }
      await runtime.dispose()
    },
  }
}

/**
 * React error boundary that catches synchronous render errors thrown by the
 * user-supplied {@link ProgramSpec.view}. Without this, an exception in the
 * view would propagate up to the OpenTUI root and leave the terminal in a
 * half-rendered state with no diagnostic. Instead we render an error pane
 * and log the cause; the rest of the program (controller, dispatch, fibers)
 * continues running so users can navigate away with `q`/Ctrl-C.
 */
interface ViewErrorBoundaryState {
  readonly error: Error | null
}

class ViewErrorBoundary extends Component<
  { readonly children: ReactNode },
  ViewErrorBoundaryState
> {
  constructor(props: { readonly children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // oxlint-disable-next-line eslint/no-console -- intentional surfacing of unrecoverable view-render failures
    console.error('[Tui.Program] view render crashed:', error, info.componentStack ?? '')
  }

  override render() {
    if (this.state.error) {
      return createElement(
        'box',
        {
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          border: true,
          borderStyle: 'rounded',
          borderColor: '#FF5555',
          title: ' View crashed ',
        },
        createElement('text', {
          content: `Render error: ${this.state.error.message}`,
          fg: '#FF5555',
        }),
        createElement('text', {
          content: 'Press q or Ctrl-C to exit.',
          fg: '#888888',
        }),
      )
    }
    return this.props.children
  }
}

function ProgramInner<State, Action, Command, R = never>(
  { spec, layer }: ProgramProps<State, Action, Command, R>,
  ref: ForwardedRef<ProgramTestHandle>,
) {
  const renderer = useRenderer()
  // Memoize on the user-supplied `layer` prop, NOT on `resolveLayer(layer)`
  // — the resolver returns a fresh `Layer.empty` every call when the user
  // passes no layer, which would invalidate the controller useMemo on every
  // parent re-render and recreate the runtime (losing program state).
  const resolvedLayer = useMemo(() => resolveLayer(layer), [layer])
  const controller = useMemo(
    () => createController(spec, resolvedLayer, () => renderer.destroy()),
    [renderer, resolvedLayer, spec],
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )

  useImperativeHandle(ref, () => ({ settled: controller.settled }), [controller])

  useEffect(() => {
    controller.start()
    return () => {
      // dispose returns a Promise — surface any rejection (interrupted
      // fiber error, runtime-disposal failure) instead of silently
      // discarding it via fire-and-forget. React's useEffect cleanup is
      // sync (no async return), so a native Promise.catch is the only
      // option here.
      // oxlint-disable-next-line kitz/effect/no-promise-then-chain -- React useEffect cleanup is sync; cannot yield Effect
      controller.dispose().catch((error) => {
        // oxlint-disable-next-line eslint/no-console -- intentional surfacing of dispose failures
        console.error('[Tui.Program] controller dispose failed:', error)
      })
    }
  }, [controller])

  useKeyboard((event) => {
    if (!spec.onKey) return
    // Guard against `spec.onKey` throwing synchronously. OpenTUI's keyHandler
    // is an EventEmitter; an uncaught throw in a handler would propagate
    // unpredictably (sometimes `error` event, sometimes process abort).
    // Logging + dropping the keypress is the resilient choice.
    let actions: Batch<Action>
    try {
      actions = spec.onKey(controller.getSnapshot(), event)
    } catch (error) {
      // oxlint-disable-next-line eslint/no-console -- intentional surfacing of unrecoverable onKey failures
      console.error('[Tui.Program] onKey threw on event:', event, error)
      return
    }
    controller.dispatchMany(normalizeBatch(actions))
  })

  const View = spec.view
  return createElement(
    ViewErrorBoundary,
    null,
    createElement(View, { state, dispatch: controller.dispatch }),
  )
}

/**
 * Drives an Elm-style {@link ProgramSpec} as a React component over OpenTUI.
 *
 * Forwards a ref of type {@link ProgramTestHandle} for tests; production
 * callers can ignore the ref.
 */
export const Program = forwardRef(ProgramInner) as <State, Action, Command, R = never>(
  props: ProgramProps<State, Action, Command, R> & { ref?: ForwardedRef<ProgramTestHandle> },
) => ReturnType<typeof ProgramInner<State, Action, Command, R>>
