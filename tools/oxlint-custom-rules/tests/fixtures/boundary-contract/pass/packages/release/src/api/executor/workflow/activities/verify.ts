import { Effect } from 'effect'
import { verifyRegistryPublication } from '../../registry-verification.js'

export const verifyPublishedRelease = (params: { readonly packageName: string }) =>
  Effect.gen(function* () {
    const verification = yield* verifyRegistryPublication({ packageName: params.packageName })
    return verification
  })
