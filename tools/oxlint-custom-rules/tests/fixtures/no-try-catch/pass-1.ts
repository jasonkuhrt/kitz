import { Effect } from 'effect'

const read = Effect.try({
  try: () => 1,
  catch: () => 0,
})

void read
