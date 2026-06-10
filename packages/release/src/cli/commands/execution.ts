import { Env } from '@kitz/env'
import { Console, Effect, Fiber, Stream, Terminal } from 'effect'
import * as Api from '../../api/__.js'

export const confirm = (message: string) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal
    yield* terminal.display(message)
    const answer = yield* terminal.readLine.pipe(Effect.catch(() => Effect.succeed('')))
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  })

export const runObservableCommand = <R>(
  observable: Pick<Api.Executor.ObservableResult<R>, 'events' | 'execute'>,
): Effect.Effect<
  Api.Executor.ExecutionResult,
  Api.Executor.ObservableExecutionError,
  Env.Env | R
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const eventFiber = yield* observable.events.pipe(
      Stream.tap((event) => {
        const line = Api.Renderer.formatLifecycleEvent(event, { env: env.vars })
        if (!line) return Effect.void
        return line.level === 'error' ? Console.error(line.message) : Console.log(line.message)
      }),
      Stream.runDrain,
      Effect.forkChild,
    )

    const result = yield* observable.execute
    yield* Fiber.join(eventFiber)
    yield* Console.log(
      Api.Renderer.renderApplyDone(result.releasedPackages.length, { env: env.vars }),
    )
    return result
  })
