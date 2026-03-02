import { Schema } from 'effect'

const PayloadSchema = Schema.Struct({
  token: Schema.String,
})

export const parseRequest = async (request: Request) => {
  const payload = await request.json()
  return Schema.decodeUnknown(PayloadSchema)(payload)
}
