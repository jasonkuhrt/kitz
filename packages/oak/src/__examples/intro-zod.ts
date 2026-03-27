import * as z from 'zod/v4'
import { Command } from '../__.js'
import { Zod } from '../_entrypoints/extensions.js'

const args = await Command.create()
  .use(Zod)
  .parameter(`filePath`, z.string().describe(`Path to the file to convert.`))
  .parameter(`to`, z.enum([`json`, `yaml`, `toml`]).describe(`Format to convert to.`))
  .parameter(`from`, z.enum([`json`, `yaml`, `toml`]).optional())
  .parameter(
    `verbose v`,
    z.boolean().default(false).describe(`Log detailed progress as conversion executes.`),
  )
  .parameter(
    `move m`,
    z.boolean().default(false).describe(`Delete the original file after it has been converted.`),
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
args.move
args.to
args.verbose
