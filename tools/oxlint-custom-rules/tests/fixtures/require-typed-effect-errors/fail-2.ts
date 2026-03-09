import { Effect } from 'effect'

export interface Service {
  readonly run: Effect.Effect<number, unknown, never>
}
