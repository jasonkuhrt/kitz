import { Schema } from 'effect'

const decodeString = Schema.decodeUnknownSync(Schema.String)
const value = decodeString('hello')

void value
