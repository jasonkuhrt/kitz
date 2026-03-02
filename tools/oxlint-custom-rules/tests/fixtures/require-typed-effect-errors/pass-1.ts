import { Effect } from 'effect'

class DomainError {
  readonly _tag = 'DomainError'
}

export type Program = Effect.Effect<string, DomainError, never>
