import { Effect } from 'effect'

interface DomainError {
  readonly _tag: 'DomainError'
  readonly message: string
}

export type Program = Effect.Effect<string, DomainError, never>
