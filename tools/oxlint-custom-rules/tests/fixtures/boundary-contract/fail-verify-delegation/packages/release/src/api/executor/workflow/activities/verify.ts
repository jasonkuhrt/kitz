import { Effect } from 'effect'

export const verifyPublishedRelease = (params: { readonly packageName: string }) =>
  Effect.sync(() => {
    const observedAt = new Date()
    return { packageName: params.packageName, observedAt }
  })
