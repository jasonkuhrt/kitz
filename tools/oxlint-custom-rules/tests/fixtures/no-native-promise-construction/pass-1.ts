import { Effect } from 'effect'

const task = Effect.promise(() => Promise.resolve(1))

void task
