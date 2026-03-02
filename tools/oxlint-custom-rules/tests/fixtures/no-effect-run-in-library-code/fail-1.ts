import { Effect } from 'effect'

const value = Effect.runPromise(Effect.succeed(1))

void value
