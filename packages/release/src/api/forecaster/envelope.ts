import { Schema } from 'effect'
import type { PublishRecord, PublishState } from '../commentator/metadata.js'
import { PublishRecordSchema, PublishStateSchema } from '../commentator/metadata.js'
import { Forecast } from './models.js'

export interface ForecastEnvelope {
  readonly forecast: Forecast
  readonly publishState: PublishState
  readonly publishHistory: readonly PublishRecord[]
}

export const ForecastEnvelope = Schema.Struct({
  forecast: Forecast,
  publishState: PublishStateSchema,
  publishHistory: Schema.Array(PublishRecordSchema),
})

export const ForecastEnvelopeJson = Schema.fromJsonString(ForecastEnvelope)

export const encodeForecastEnvelope: (input: ForecastEnvelope) => string =
  Schema.encodeSync(ForecastEnvelopeJson)
