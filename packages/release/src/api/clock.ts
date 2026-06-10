import { Clock as EffectClock, Effect } from 'effect'

export const isoStringFromEpochMillis = (epochMillis: number): string =>
  new Date(epochMillis).toISOString()

export const nowIso = Effect.map(EffectClock.currentTimeMillis, isoStringFromEpochMillis)
