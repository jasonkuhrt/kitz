import { Test } from '@kitz/test'
import { Schema as S } from 'effect'
import { expect } from 'bun:test'
import { AbsDir } from './AbsDir/_.js'
import { AbsFile } from './AbsFile/_.js'
import { RelDir } from './RelDir/_.js'
import { RelFile } from './RelFile/_.js'

// ─── Derived-arbitrary contract properties ───────────────────────────
//
// Pins that Schema.toArbitrary on every path codec generates instances that
// satisfy the codec and survive the string form. FileName carries
// canonical-form field generators (dot-free stems, single-dot extensions)
// because its structural fields admit values whose encoding re-decodes
// differently.

const pin = (name: string, codec: S.Codec<any, any>) => {
  const arb = S.toArbitrary(codec)

  Test.property(`generated ${name} values satisfy the codec`, arb, (value) => {
    expect(S.is(codec)(value)).toBe(true)
  })

  Test.property(`generated ${name} values roundtrip through the string form`, arb, (value) => {
    const encoded = S.encodeUnknownSync(codec)(value)
    const decoded = S.decodeUnknownSync(codec)(encoded)
    const reEncoded = S.encodeUnknownSync(codec)(decoded)
    expect(reEncoded).toBe(encoded)
  })
}

pin('AbsFile', AbsFile.Schema)
pin('RelFile', RelFile.Schema)
pin('AbsDir', AbsDir.Schema)
pin('RelDir', RelDir.Schema)
