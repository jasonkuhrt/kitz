import { Schema } from 'effect'

const decode = Schema.decodeUnknownSync(Schema.Struct({ tag: Schema.String }))
const parsed = decode({ tag: 'A' })

void parsed
