import { Effect, Random } from 'effect'

export const randomProgram = Effect.flatMap(Random.next, (n) => Effect.succeed(n))
