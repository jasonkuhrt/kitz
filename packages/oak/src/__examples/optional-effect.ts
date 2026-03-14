import { Schema, SchemaGetter } from 'effect'
import { Command } from '../__.js'
import { EffectSchema } from '../_entrypoints/extensions.js'

const args = Command.create()
  .use(EffectSchema)
  // UndefinedOr - returns undefined when omitted
  .parameter(`name`, Schema.UndefinedOr(Schema.String))
  // Optional number - returns undefined when omitted
  .parameter(`age`, Schema.UndefinedOr(Schema.Number))
  // Optional with pipe - returns undefined when omitted
  .parameter(
    `email`,
    Schema.UndefinedOr(Schema.String).pipe(Schema.annotate({ description: 'Email address' })),
  )
  // Transform with default - returns default when omitted
  .parameter(
    `verbose v`,
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((v) => v ?? false),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(Schema.annotate({ default: false })),
  )
  .parse()

console.log(args.age, args.email, args.name, args.verbose)
