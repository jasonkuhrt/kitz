import { Effect } from 'effect'

export type Program = Effect.Effect<string, { message: string }, never>
