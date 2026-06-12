import { Schema } from 'effect'
import { PublishRecordSchema, PublishStateSchema } from '../commentator/metadata.js'
import { Forecast } from './models.js'

export const ForecastEnvelope = Schema.Struct({
  forecast: Forecast,
  publishState: PublishStateSchema,
  publishHistory: Schema.Array(PublishRecordSchema),
})

export type ForecastEnvelope = typeof ForecastEnvelope.Type

export const ForecastEnvelopeJson = Schema.fromJsonString(ForecastEnvelope)

export const encodeForecastEnvelope: (input: ForecastEnvelope) => string =
  Schema.encodeSync(ForecastEnvelopeJson)
