import { Effect } from 'effect'

class ParseError {
  readonly _tag = 'ParseError'
}

class DomainError {
  readonly _tag = 'DomainError'
}

export type Program = Effect.Effect<string, ParseError | DomainError, never>
