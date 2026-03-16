import { Schema } from 'effect'

class _Error extends Schema.TaggedClass<_Error>()('Error', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(_Error)
}

class _Warn extends Schema.TaggedClass<_Warn>()('Warn', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(_Warn)
}

export const Severity = Schema.Union([_Error, _Warn]).pipe(Schema.toTaggedUnion('_tag'))
export type Severity = typeof Severity.Type

export namespace Severity {
  export type Error = import('./pass-1.js')._Error
  export type Warn = import('./pass-1.js')._Warn
}
