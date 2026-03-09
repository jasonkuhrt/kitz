import { Effect } from 'effect'

const program = Effect.succeed(1).pipe(Effect.map((n) => n + 1))

void program
