import { Clock, Effect } from 'effect'

export const nowProgram = Effect.flatMap(Clock.currentTimeMillis, (n) => Effect.succeed(n))
