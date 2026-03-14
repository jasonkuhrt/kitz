import { Schema, SchemaGetter } from 'effect'
import { Command } from '../__.js'
import { EffectSchema } from '../_entrypoints/extensions.js'

const args = await Command.create()
  .use(EffectSchema)
  .parameter(
    `filePath`,
    Schema.String.pipe(Schema.annotate({ description: `Path to the file to convert.` })),
  )
  .parameter(
    `to`,
    Schema.Literals([`json`, `yaml`, `toml`]).pipe(
      Schema.annotate({ description: `Format to convert to.` }),
    ),
  )
  .parameter(
    `from`,
    Schema.UndefinedOr(Schema.Literals([`json`, `yaml`, `toml`])).pipe(
      Schema.annotate({ description: `Source format (auto-detected if omitted).` }),
    ),
  )
  .parameter(
    `output o`,
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: `Output file path (prints to stdout if omitted).` }),
    ),
  )
  .parameter(
    `encoding`,
    Schema.UndefinedOr(Schema.Literals([`utf8`, `utf16`, `ascii`])).pipe(
      Schema.annotate({ description: `File encoding to use.` }),
    ),
  )
  .parameter(
    `verbose v`,
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((value) => value ?? false),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(
        Schema.annotate({
          description: `Log detailed progress as conversion executes.`,
          default: false,
        }),
      ),
  )
  .parameter(
    `move m`,
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((value) => value ?? false),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(
        Schema.annotate({
          description: `Delete the original file after it has been converted.`,
          default: false,
        }),
      ),
  )
  .settings({
    prompt: {
      // TODO allow making parameter level opt-in or opt-out
      // default: false,
      when: [
        {
          result: `rejected`,
          error: `OakErrorMissingArgument`,
        },
        { result: `omitted` },
      ],
    },
  })
  .parse()

args.filePath
args.from
args.to
args.output
args.encoding
args.verbose
args.move
