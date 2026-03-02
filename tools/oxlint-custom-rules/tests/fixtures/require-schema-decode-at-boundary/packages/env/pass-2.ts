import { Schema } from 'effect'

const EnvSchema = Schema.Struct({
  KITZ_TOKEN: Schema.String,
})

export const readEnv = () =>
  Schema.decodeUnknownSync(EnvSchema)({
    KITZ_TOKEN: process.env.KITZ_TOKEN,
  })
