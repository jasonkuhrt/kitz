import * as Schema from 'effect/Schema'

/** A configured memory tree is structurally inconsistent. */
export class InitializationError extends Schema.TaggedErrorClass<InitializationError>()(
  '@kitz/effect/MemoryFileSystem/InitializationError',
  {
    reason: Schema.Literals([
      'DuplicateEntry',
      'InvalidCwd',
      'MissingParent',
      'MissingCwd',
      'CwdNotDirectory',
    ]),
    path: Schema.String,
  },
) {}
