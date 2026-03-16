import { Schema } from 'effect'

// Missing all standard statics
export class Error extends Schema.TaggedClass<Error>()('Error', {}) {}
