import { Effect } from 'effect'

const value = Effect.runSync(Effect.succeed(1))

void value
